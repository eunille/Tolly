import AppIntents

/// Runs in the background (no app UI) so it works from a locked phone. Siri speaks the dialog;
/// a Shortcuts automation ("When <car> Bluetooth connects") pipes the returned text into "Speak Text".
struct GetTollBalancesIntent: AppIntent {
  static let title: LocalizedStringResource = "Get Toll Balances"
  static let description: IntentDescription = "Checks Autosweep live and reads your last saved Easytrip balance."
  static let openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let text = await TollAnnouncer.announcement()
    return .result(value: text, dialog: "\(text)")
  }
}
