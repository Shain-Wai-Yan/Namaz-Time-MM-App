package com.xolbine.namaztimemm;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.WindowManager;
import android.view.Surface;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private Sensor magneticSensor;
    private Sensor accelerometerSensor;
    private boolean isWatching = false;
    private long lastEmit = 0;
    private static final int EMIT_INTERVAL_MS = 66;

    private float[] gravity = null;
    private float[] geomagnetic = null;

    private boolean locationSet = false;
    private float userLatitude = 0f;
    private float userLongitude = 0f;
    private float userAltitude = 0f;

    private float lastHeading = -1f;
    private static final float MAX_HEADING_JUMP = 60f;
    private int spikeCount = 0;
    private static final int SPIKE_THRESHOLD = 3;
    private long lastStableTime = 0;
    private static final long STABILIZATION_DELAY_MS = 150;
    private boolean isShaking = false;
    
    private float[] headingHistory = new float[5];
    private int historyIndex = 0;
    private boolean historyFilled = false;

    private float smoothedSin = 0f;
    private float smoothedCos = 1f;
    private boolean sinCosInitialized = false;
    private static final float ALPHA = 0.15f;
    
    private boolean hasMagneticInterference = false;

    @PluginMethod
    public void setLocation(PluginCall call) {
        userLatitude = call.getFloat("latitude", 0f);
        userLongitude = call.getFloat("longitude", 0f);
        userAltitude = call.getFloat("altitude", 0f);
        locationSet = true;
        call.resolve();
    }

    private float getMagneticDeclination() {
        if (!locationSet) {
            return 0f;
        }
        GeomagneticField field = new GeomagneticField(
            userLatitude,
            userLongitude,
            userAltitude,
            System.currentTimeMillis()
        );
        return field.getDeclination();
    }

    @PluginMethod
    public void startWatching(PluginCall call) {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }

        resetState();

        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

        if (rotationSensor != null) {
            boolean registered = sensorManager.registerListener(
                this,
                rotationSensor,
                SensorManager.SENSOR_DELAY_UI
            );

            if (registered) {
                isWatching = true;
                if (call != null) call.resolve();
                return;
            }
        }

        magneticSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);

        if (magneticSensor != null && accelerometerSensor != null) {
            sensorManager.registerListener(this, magneticSensor, SensorManager.SENSOR_DELAY_UI);
            sensorManager.registerListener(this, accelerometerSensor, SensorManager.SENSOR_DELAY_UI);
            isWatching = true;
            if (call != null) call.resolve();
        } else {
            if (call != null) call.reject("No compass sensors available");
        }
    }

    private void resetState() {
        gravity = null;
        geomagnetic = null;
        lastHeading = -1f;
        spikeCount = 0;
        isShaking = false;
        lastStableTime = System.currentTimeMillis();
        historyIndex = 0;
        historyFilled = false;
        headingHistory = new float[5];
        sinCosInitialized = false;
        smoothedSin = 0f;
        smoothedCos = 1f;
        hasMagneticInterference = false;
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        if (sensorManager != null && isWatching) {
            sensorManager.unregisterListener(this);
            isWatching = false;
            resetState();
        }
        if (call != null) call.resolve();
    }

    @Override
    protected void handleOnPause() {
        if (isWatching && sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        if (isWatching && sensorManager != null) {
            resetState();
            startWatching(null);
        }
        super.handleOnResume();
    }

    private float angularDifference(float a, float b) {
        float diff = Math.abs(a - b);
        if (diff > 180f) {
            diff = 360f - diff;
        }
        return diff;
    }

    private float getMedianHeading() {
        int count = historyFilled ? headingHistory.length : historyIndex;
        if (count == 0) return -1f;
        
        float[] sorted = new float[count];
        System.arraycopy(headingHistory, 0, sorted, 0, count);
        java.util.Arrays.sort(sorted);
        
        return sorted[count / 2];
    }

    private boolean isSpike(float newHeading) {
        if (lastHeading < 0) {
            return false;
        }
        
        float diff = angularDifference(newHeading, lastHeading);
        return diff > MAX_HEADING_JUMP;
    }

    private float smoothHeadingWithSinCos(float rawHeading) {
        float radians = (float) Math.toRadians(rawHeading);
        float sin = (float) Math.sin(radians);
        float cos = (float) Math.cos(radians);
        
        if (!sinCosInitialized) {
            smoothedSin = sin;
            smoothedCos = cos;
            sinCosInitialized = true;
        } else {
            smoothedSin = ALPHA * sin + (1 - ALPHA) * smoothedSin;
            smoothedCos = ALPHA * cos + (1 - ALPHA) * smoothedCos;
        }
        
        float smoothedRadians = (float) Math.atan2(smoothedSin, smoothedCos);
        float smoothedDegrees = (float) Math.toDegrees(smoothedRadians);
        return (smoothedDegrees + 360) % 360;
    }

    private float processHeading(float rawHeading) {
        headingHistory[historyIndex] = rawHeading;
        historyIndex = (historyIndex + 1) % headingHistory.length;
        if (historyIndex == 0) historyFilled = true;
        
        if (isSpike(rawHeading)) {
            spikeCount++;
            
            if (spikeCount >= SPIKE_THRESHOLD) {
                resetState();
                lastHeading = rawHeading;
                isShaking = true;
                lastStableTime = System.currentTimeMillis();
                sinCosInitialized = false;
                return smoothHeadingWithSinCos(rawHeading);
            }
            
            float median = getMedianHeading();
            if (median >= 0) {
                return smoothHeadingWithSinCos(median);
            }
            return smoothHeadingWithSinCos(lastHeading);
        }
        
        spikeCount = 0;
        
        if (isShaking) {
            long now = System.currentTimeMillis();
            if (now - lastStableTime > STABILIZATION_DELAY_MS) {
                isShaking = false;
            }
        }
        
        lastHeading = rawHeading;
        return smoothHeadingWithSinCos(rawHeading);
    }

    private int[] getRemappedAxes() {
        int worldAxisX = SensorManager.AXIS_X;
        int worldAxisY = SensorManager.AXIS_Y;
        
        try {
            WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
            int rotation = wm.getDefaultDisplay().getRotation();
            
            switch (rotation) {
                case Surface.ROTATION_90:
                    worldAxisX = SensorManager.AXIS_Y;
                    worldAxisY = SensorManager.AXIS_MINUS_X;
                    break;
                case Surface.ROTATION_180:
                    worldAxisX = SensorManager.AXIS_MINUS_X;
                    worldAxisY = SensorManager.AXIS_MINUS_Y;
                    break;
                case Surface.ROTATION_270:
                    worldAxisX = SensorManager.AXIS_MINUS_Y;
                    worldAxisY = SensorManager.AXIS_X;
                    break;
                default: // ROTATION_0
                    break;
            }
        } catch (Exception e) {
            // Fallback to default axes
        }
        
        return new int[] { worldAxisX, worldAxisY };
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        long now = System.currentTimeMillis();
        if (now - lastEmit < EMIT_INTERVAL_MS) return;
        lastEmit = now;

        float heading = 0;
        int accuracy = event.accuracy;
        float pitch = 0;
        float roll = 0;

        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            float[] rotationMatrix = new float[9];
            float[] adjustedMatrix = new float[9];
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);

            int[] axes = getRemappedAxes();
            SensorManager.remapCoordinateSystem(
                rotationMatrix,
                axes[0],
                axes[1],
                adjustedMatrix
            );

            float[] orientation = new float[3];
            SensorManager.getOrientation(adjustedMatrix, orientation);

            float azimuthRadians = orientation[0];
            pitch = (float) Math.toDegrees(orientation[1]);
            roll = (float) Math.toDegrees(orientation[2]);

            float azimuthDegrees = (float) Math.toDegrees(azimuthRadians);
            float declination = getMagneticDeclination();
            float rawHeading = (azimuthDegrees + declination + 360) % 360;
            
            heading = processHeading(rawHeading);

            JSObject ret = new JSObject();
            ret.put("heading", heading);
            ret.put("accuracy", accuracy);
            ret.put("pitch", pitch);
            ret.put("roll", roll);
            ret.put("needsLevelWarning", Math.abs(pitch) > 30 || Math.abs(roll) > 30);
            ret.put("isStabilizing", isShaking);
            ret.put("hasMagneticInterference", hasMagneticInterference);
            notifyListeners("headingChanged", ret);

        } else if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            gravity = lowPass(event.values.clone(), gravity);
            
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            geomagnetic = lowPass(event.values.clone(), geomagnetic);
            
            float magnitude = (float) Math.sqrt(
                event.values[0] * event.values[0] + 
                event.values[1] * event.values[1] + 
                event.values[2] * event.values[2]
            );
            hasMagneticInterference = (magnitude < 25 || magnitude > 65);
        }

        if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD && gravity != null && geomagnetic != null) {
            float[] R = new float[9];
            float[] I = new float[9];
            
            if (SensorManager.getRotationMatrix(R, I, gravity, geomagnetic)) {
                float[] adjustedMatrix = new float[9];
                int[] axes = getRemappedAxes();
                SensorManager.remapCoordinateSystem(
                    R,
                    axes[0],
                    axes[1],
                    adjustedMatrix
                );
                
                float[] orientation = new float[3];
                SensorManager.getOrientation(adjustedMatrix, orientation);
                
                float azimuthRadians = orientation[0];
                pitch = (float) Math.toDegrees(orientation[1]);
                roll = (float) Math.toDegrees(orientation[2]);

                float azimuthDegrees = (float) Math.toDegrees(azimuthRadians);
                float declination = getMagneticDeclination();
                float rawHeading = (azimuthDegrees + declination + 360) % 360;
                
                heading = processHeading(rawHeading);
                
                JSObject ret = new JSObject();
                ret.put("heading", heading);
                ret.put("accuracy", accuracy);
                ret.put("pitch", pitch);
                ret.put("roll", roll);
                ret.put("needsLevelWarning", Math.abs(pitch) > 30 || Math.abs(roll) > 30);
                ret.put("isStabilizing", isShaking);
                ret.put("hasMagneticInterference", hasMagneticInterference);
                notifyListeners("headingChanged", ret);
            }
        }
    }

    private float[] lowPass(float[] input, float[] output) {
        if (output == null) return input;
        
        for (int i = 0; i < input.length; i++) {
            output[i] = output[i] + ALPHA * (input[i] - output[i]);
        }
        return output;
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (accuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW) {
            JSObject ret = new JSObject();
            ret.put("needsCalibration", true);
            ret.put("sensorAccuracy", accuracy);
            notifyListeners("accuracyWarning", ret);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (sensorManager != null && isWatching) {
            sensorManager.unregisterListener(this);
        }
        super.handleOnDestroy();
    }
}
