import Foundation
import Security

/// Reads and writes the same Keychain items as src/lib/kv.ts (expo-secure-store, keychainService "toll").
/// expo-secure-store's layout: service "<keychainService>:no-auth", account and generic = key as UTF-8 data.
enum TollStore {
  private static let service = "toll:no-auth"

  private static func query(_ key: String) -> [String: Any] {
    let k = Data(key.utf8)
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrGeneric as String: k,
      kSecAttrAccount as String: k,
    ]
  }

  static func get(_ key: String) -> String? {
    var q = query(key)
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var out: AnyObject?
    guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func set(_ key: String, _ value: String) {
    let data = Data(value.utf8)
    let status = SecItemUpdate(query(key) as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    guard status == errSecItemNotFound else { return }
    var q = query(key)
    q[kSecValueData as String] = data
    q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock // readable in a locked phone
    SecItemAdd(q as CFDictionary, nil)
  }

  static func decode<T: Decodable>(_ key: String, as type: T.Type) -> T? {
    guard let raw = get(key) else { return nil }
    return try? JSONDecoder().decode(type, from: Data(raw.utf8))
  }

  static func encode<T: Encodable>(_ key: String, _ value: T) {
    guard let data = try? JSONEncoder().encode(value), let s = String(data: data, encoding: .utf8) else { return }
    set(key, s)
  }
}
