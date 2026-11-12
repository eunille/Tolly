package expo.modules.cartrigger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Foreground service that runs the JS "TollAnnounce" task (fetch balances, then speak).
 * Reusing the JS adapters keeps provider logic in one place instead of duplicating it in Kotlin.
 */
class AnnounceService : HeadlessJsTaskService() {
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Must be called within 5 s of startForegroundService().
    val n = notification()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, n)
    }
    return super.onStartCommand(intent, flags, startId)
  }

  override fun getTaskConfig(intent: Intent?) =
    // 45 s covers two provider round trips plus speech; JS also has its own per-request timeout.
    HeadlessJsTaskConfig(TASK_KEY, Arguments.createMap(), 45_000, true)

  override fun onDestroy() {
    stopForeground(Service.STOP_FOREGROUND_REMOVE) // minSdk is 24, where this overload exists
    super.onDestroy()
  }

  private fun notification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Balance announcements", NotificationManager.IMPORTANCE_LOW)
      )
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    return builder
      // ponytail: system icon; swap for a monochrome Catalyx drawable when the real app ships.
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setContentTitle("Checking toll balances")
      .setOngoing(true)
      .build()
  }

  companion object {
    const val TASK_KEY = "TollAnnounce"
    private const val CHANNEL_ID = "toll_announce"
    private const val NOTIFICATION_ID = 4201

    fun start(context: Context) {
      HeadlessJsTaskService.acquireWakeLockNow(context)
      val intent = Intent(context, AnnounceService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
