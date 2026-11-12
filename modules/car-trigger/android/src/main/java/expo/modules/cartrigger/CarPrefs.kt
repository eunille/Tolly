package expo.modules.cartrigger

import android.content.Context

/** The one paired car, kept in SharedPreferences so the receiver can read it without JS. */
internal object CarPrefs {
  private fun prefs(c: Context) = c.getSharedPreferences("car_trigger", Context.MODE_PRIVATE)

  fun address(c: Context): String? = prefs(c).getString("address", null)

  fun car(c: Context): Map<String, Any>? {
    val p = prefs(c)
    val address = p.getString("address", null) ?: return null
    return mapOf("address" to address, "name" to (p.getString("name", null) ?: "Car"))
  }

  fun associationId(c: Context): Int = prefs(c).getInt("associationId", -1)

  fun save(c: Context, address: String, name: String, associationId: Int) {
    prefs(c).edit()
      .putString("address", address.uppercase())
      .putString("name", name)
      .putInt("associationId", associationId)
      .apply()
  }

  fun clear(c: Context) = prefs(c).edit().clear().apply()

  // ponytail: fixed 2-min debounce; make it remote-config if cars reconnect in slower cycles
  private const val DEBOUNCE_MS = 2 * 60 * 1000L

  /** True if we should announce now; records the time. Cars often drop and rejoin Bluetooth. */
  fun claimAnnounceSlot(c: Context): Boolean {
    val now = System.currentTimeMillis()
    val last = prefs(c).getLong("lastAnnounce", 0)
    if (now - last < DEBOUNCE_MS) return false
    prefs(c).edit().putLong("lastAnnounce", now).apply()
    return true
  }
}
