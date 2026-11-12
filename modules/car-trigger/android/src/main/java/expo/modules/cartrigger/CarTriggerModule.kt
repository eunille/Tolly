package expo.modules.cartrigger

import android.app.Activity
import android.companion.AssociationInfo
import android.companion.AssociationRequest
import android.companion.BluetoothDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.Context
import android.content.IntentSender
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val REQUEST_CODE = 4202

class CarTriggerModule : Module() {
  private var pending: Promise? = null
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("CarTrigger")

    Function("getCar") { CarPrefs.car(context) }

    // ponytail: Android 13+ only (AssociationInfo / executor callback). Add the deprecated
    // pre-33 associate() path if test phones on Android 12 or older matter.
    AsyncFunction("pairCar") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 33) {
        promise.reject("ERR_OS_TOO_OLD", "Car pairing needs Android 13 or newer", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "App must be in the foreground to pair a car", null)
        return@AsyncFunction
      }
      pending?.reject("ERR_SUPERSEDED", "Another pairing started", null)
      pending = promise

      val cdm = activity.getSystemService(CompanionDeviceManager::class.java)
      val request = AssociationRequest.Builder()
        .addDeviceFilter(BluetoothDeviceFilter.Builder().build()) // any classic Bluetooth device
        .setSingleDevice(false)
        .build()
      cdm.associate(request, activity.mainExecutor, object : CompanionDeviceManager.Callback() {
        override fun onAssociationPending(intentSender: IntentSender) {
          activity.startIntentSenderForResult(intentSender, REQUEST_CODE, null, 0, 0, 0)
        }

        override fun onAssociationCreated(associationInfo: AssociationInfo) = Unit // read in OnActivityResult

        override fun onFailure(error: CharSequence?) {
          pending?.reject("ERR_PAIR_FAILED", error?.toString() ?: "Car pairing failed", null)
          pending = null
        }
      })
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val p = pending ?: return@OnActivityResult
      pending = null
      if (payload.resultCode != Activity.RESULT_OK || Build.VERSION.SDK_INT < 33) {
        p.reject("ERR_CANCELLED", "Car pairing was cancelled", null)
        return@OnActivityResult
      }
      val info = payload.data?.getParcelableExtra(CompanionDeviceManager.EXTRA_ASSOCIATION, AssociationInfo::class.java)
      val address = info?.deviceMacAddress?.toString()
      if (info == null || address == null) {
        p.reject("ERR_NO_DEVICE", "No device came back from pairing", null)
        return@OnActivityResult
      }
      val name = info.displayName?.toString() ?: "Car"
      CarPrefs.save(context, address, name, info.id)
      p.resolve(mapOf("address" to address.uppercase(), "name" to name))
    }

    Function("forgetCar") {
      val id = CarPrefs.associationId(context)
      if (Build.VERSION.SDK_INT >= 33 && id >= 0) {
        context.getSystemService(CompanionDeviceManager::class.java).disassociate(id)
      }
      CarPrefs.clear(context)
    }

    // Spike helper: start the same service the car would, after a delay, so you can
    // lock the phone first and check it speaks with the screen off.
    Function("testAnnounce") { delaySeconds: Int ->
      val ctx = context.applicationContext
      Handler(Looper.getMainLooper()).postDelayed({ AnnounceService.start(ctx) }, delaySeconds * 1000L)
    }
  }
}
