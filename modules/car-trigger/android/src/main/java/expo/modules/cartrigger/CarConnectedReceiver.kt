package expo.modules.cartrigger

import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class CarConnectedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != BluetoothDevice.ACTION_ACL_CONNECTED) return
    val device = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
    val car = CarPrefs.address(context) ?: return
    if (!car.equals(device?.address, ignoreCase = true)) return
    if (!CarPrefs.claimAnnounceSlot(context)) return

    Log.i("CarTrigger", "Car connected, starting announcement")
    try {
      AnnounceService.start(context)
    } catch (e: Exception) {
      // Most likely ForegroundServiceStartNotAllowedException: the CDM exemption didn't apply.
      // That's exactly what the spike needs to learn, so log it loudly.
      Log.e("CarTrigger", "Could not start AnnounceService from background", e)
    }
  }
}
