import AppIntents

/// Phrases are compiled into the app. Every phrase must include \(.applicationName).
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: GetTollBalancesIntent(),
      phrases: [
        "Check toll balances in \(.applicationName)",
        "Get my toll balance in \(.applicationName)",
      ],
      shortTitle: "Toll Balances",
      systemImageName: "car.fill"
    )
  }
}
