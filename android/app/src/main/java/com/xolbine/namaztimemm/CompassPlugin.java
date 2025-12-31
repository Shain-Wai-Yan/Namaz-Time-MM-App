package com.xolbine.namaztimemm;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private boolean isWatching = false;
    private long lastEmit = 0;

    @PluginMethod
    public void startWatching(PluginCall call) {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }

        // Use TYPE_ROTATION_VECTOR for fused sensor data (OEM-quality)
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

        if (rotationSensor == null) {
            call.reject("Rotation sensor not available");
            return;
        }

        // Register with SENSOR_DELAY_UI for smooth 60Hz updates
        boolean registered = sensorManager.registerListener(
            this,
            rotationSensor,
            SensorManager.SENSOR_DELAY_UI
        );

        if (registered) {
            isWatching = true;
            call.resolve();
        } else {
            call.reject("Failed to register sensor listener");
        }
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        if (sensorManager != null && isWatching) {
            sensorManager.unregisterListener(this);
            isWatching = false;
        }
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            long now = System.currentTimeMillis();
            if (now - lastEmit < 40) return; // Limit to 25 emissions per second
            lastEmit = now;

            // Convert rotation vector to rotation matrix
            float[] rotationMatrix = new float[9];
            float[] adjustedMatrix = new float[9];
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);

            // Remap coordinate system for portrait orientation
            // This prevents phantom 90°/180° errors on tablets and different OEMs
            SensorManager.remapCoordinateSystem(
                rotationMatrix,
                SensorManager.AXIS_X,
                SensorManager.AXIS_Z,
                adjustedMatrix
            );

            // Get orientation angles from adjusted matrix
            float[] orientation = new float[3];
            SensorManager.getOrientation(adjustedMatrix, orientation);

            // Azimuth is orientation[0] in radians, convert to degrees
            float azimuthRadians = orientation[0];
            float azimuthDegrees = (float) Math.toDegrees(azimuthRadians);

            // Normalize to 0-360
            float heading = (azimuthDegrees + 360) % 360;

            // Get accuracy from sensor
            int accuracy = event.accuracy;

            // Send to JavaScript
            JSObject ret = new JSObject();
            ret.put("heading", heading);
            ret.put("accuracy", accuracy);
            notifyListeners("headingChanged", ret);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Optionally handle accuracy changes
        JSObject ret = new JSObject();
        ret.put("sensorAccuracy", accuracy);
        notifyListeners("accuracyChanged", ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (sensorManager != null && isWatching) {
            sensorManager.unregisterListener(this);
        }
        super.handleOnDestroy();
    }
}
