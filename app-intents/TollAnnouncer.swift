import Foundation

// Swift twin of the JS refresh + announcement, because iOS can't run our JS in the background.
// ponytail: duplicated logic. Keep in sync with src/providers/autosweep/{client,parser}.ts and
// src/features/voice/announcement.ts (the JS side has the tests).

struct AutosweepCreds: Codable { let email: String; let password: String }
struct CachedBalance: Codable { let amount: Double; let asOf: Double } // asOf: epoch ms

enum AutosweepError: Error { case badLogin, locked, unexpected, network }

enum Autosweep {
  private static let api = URL(string: "https://autosweeprfidapps.com/api/v3/portalnew/index.php")!

  /// Multipart form POST, same as the portal's own FormData calls. The ephemeral session keeps the login cookie.
  private static func post(_ fields: [String: String], _ session: URLSession) async throws -> [String: Any] {
    var req = URLRequest(url: api, timeoutInterval: 10)
    req.httpMethod = "POST"
    let boundary = "toll-\(UUID().uuidString)"
    req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    var body = ""
    for (k, v) in fields { body += "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n" }
    body += "--\(boundary)--\r\n"
    req.httpBody = Data(body.utf8)

    let data: Data
    let response: URLResponse
    do { (data, response) = try await session.data(for: req) } catch { throw AutosweepError.network }
    guard (response as? HTTPURLResponse)?.statusCode == 200,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { throw AutosweepError.unexpected }
    return json
  }

  private static func number(_ v: Any?) -> Double? {
    if let n = v as? NSNumber { return n.doubleValue }
    guard let s = v as? String else { return nil }
    let cleaned = s.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "₱", with: "")
      .trimmingCharacters(in: .whitespaces)
    return cleaned.isEmpty ? nil : Double(cleaned)
  }

  /// Logs in, then reads the main account balance. Never retried on badLogin/locked (portal locks accounts).
  static func balance(_ creds: AutosweepCreds) async throws -> Double {
    let session = URLSession(configuration: .ephemeral)
    defer { session.finishTasksAndInvalidate() }

    let login = try await post(["tag": "login", "email": creds.email, "password": creds.password, "remember_me": "false"], session)
    let data = login["data"] as? [String: Any]
    switch number(login["success"]) {
    case 1:
      if number(data?["active"]) == 2 { throw AutosweepError.locked }
      let account = (data?["account_number"] as? String) ?? (data?["account_number"] as? NSNumber)?.stringValue ?? ""
      guard !account.trimmingCharacters(in: .whitespaces).isEmpty else { throw AutosweepError.unexpected }
      let reply = try await post(["tag": "checkbalance", "account_number": account.trimmingCharacters(in: .whitespaces)], session)
      // Unlike the portal, a missing balance is an error, never ₱0.
      guard let amount = number((reply["data"] as? [String: Any])?["available_balance"]) else { throw AutosweepError.unexpected }
      return amount
    case 0:
      let status = number(login["account_status"])
      throw (status == 2 || status == 3) ? AutosweepError.locked : AutosweepError.badLogin
    default:
      throw AutosweepError.unexpected
    }
  }
}

struct Reading { let label: String; let amount: Double?; let asOf: Double; let live: Bool }

enum Announcement {
  static let lowBalance = 200.0

  static func pesos(_ amount: Double) -> String {
    let totalCents = Int((abs(amount) * 100).rounded())
    let whole = totalCents / 100
    let cents = totalCents % 100
    var s = "\(amount < 0 ? "minus " : "")\(whole) \(whole == 1 ? "peso" : "pesos")"
    if cents > 0 { s += " and \(cents) \(cents == 1 ? "centavo" : "centavos")" }
    return s
  }

  static func ago(_ ms: Double) -> String? {
    let min = Int(ms / 60_000)
    if min < 1 { return nil }
    func say(_ n: Int, _ unit: String) -> String { "\(n) \(unit)\(n == 1 ? "" : "s") ago" }
    if min < 60 { return say(min, "minute") }
    let hours = min / 60
    return hours < 24 ? say(hours, "hour") : say(hours / 24, "day")
  }

  static func build(_ readings: [Reading], nowMs: Double) -> String {
    if readings.isEmpty { return "No toll accounts set up yet." }
    return readings.map { r in
      guard let amount = r.amount else { return "\(r.label) balance unavailable." }
      let age = r.live ? nil : ago(nowMs - r.asOf)
      var s = "\(r.label): \(pesos(amount))\(age.map { ", as of \($0)" } ?? "")."
      if amount < lowBalance { s += " Low, reload soon." }
      return s
    }.joined(separator: " ")
  }
}

enum TollAnnouncer {
  private static func cached(_ label: String, _ key: String) -> Reading {
    guard let c = TollStore.decode(key, as: CachedBalance.self) else {
      return Reading(label: label, amount: nil, asOf: 0, live: false)
    }
    return Reading(label: label, amount: c.amount, asOf: c.asOf, live: false)
  }

  /// Same behaviour as src/features/balances/refresh.ts + buildAnnouncement().
  static func announcement(now: Date = Date()) async -> String {
    let nowMs = now.timeIntervalSince1970 * 1000
    var readings: [Reading] = []

    if let creds = TollStore.decode("autosweep.creds", as: AutosweepCreds.self) {
      var live: Reading?
      if TollStore.get("autosweep.authBlocked") != "1" {
        do {
          let amount = try await Autosweep.balance(creds)
          TollStore.encode("balance.autosweep", CachedBalance(amount: amount, asOf: nowMs))
          live = Reading(label: "Autosweep", amount: amount, asOf: nowMs, live: true)
        } catch AutosweepError.badLogin {
          TollStore.set("autosweep.authBlocked", "1")
        } catch AutosweepError.locked {
          TollStore.set("autosweep.authBlocked", "1")
        } catch {
          // Provider down: fall through to the cached balance, spoken with its age.
        }
      }
      readings.append(live ?? cached("Autosweep", "balance.autosweep"))
    }
    if TollStore.get("easytrip.account") != nil {
      readings.append(cached("Easytrip", "balance.easytrip"))
    }
    return Announcement.build(readings, nowMs: nowMs)
  }
}
