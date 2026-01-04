package com.xolbine.namaztimemm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;

import androidx.core.app.NotificationCompat;

import java.io.IOException;

/**
 * Foreground service that plays the Adhan sound
 * Keeps the device awake and ensures audio plays even when screen is locked
 */
public class AdhanPlayerService extends Service implements 
    MediaPlayer.OnPreparedListener,
    MediaPlayer.OnCompletionListener,
    MediaPlayer.OnErrorListener,
    AudioManager.OnAudioFocusChangeListener {

    private static final String TAG = "AdhanPlayerService";
    private static final String CHANNEL_ID = "adhan_alarm_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long ADHAN_MAX_DURATION = 6 * 60 * 1000; // 6 minutes max

    private MediaPlayer mediaPlayer;
    private boolean isPlaying = false;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private String currentPrayerName;
    private Handler stopHandler = new Handler();
    private VolumeButtonReceiver volumeButtonReceiver;
    private boolean isCleanedUp = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        registerVolumeButtonReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        
        if ("STOP_ADHAN".equals(action)) {
            stopAdhan();
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("PLAY_ADHAN".equals(action)) {
            String prayerName = intent.getStringExtra("prayerName");
            String soundUri = intent.getStringExtra("soundUri");

            currentPrayerName = prayerName != null ? prayerName : "Prayer";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID, 
                    createNotification(currentPrayerName),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, createNotification(currentPrayerName));
            }

            initializeMediaPlayer(soundUri);
        }

        return START_NOT_STICKY;
    }

    private void initializeMediaPlayer(String soundUri) {
        releaseMediaPlayer();

        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            mediaPlayer.setScreenOnWhilePlaying(true); // Keep screen on while playing to prevent deep sleep interruption
            mediaPlayer.setOnPreparedListener(this);
            mediaPlayer.setOnCompletionListener(this);
            mediaPlayer.setOnErrorListener(this);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC) 
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);

            int resId = getResources().getIdentifier(soundUri, "raw", getPackageName());
            if (resId != 0) {
                mediaPlayer.setDataSource(getApplicationContext(), 
                    Uri.parse("android.resource://" + getPackageName() + "/" + resId));
            } else {
                Uri defaultUri = android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
                mediaPlayer.setDataSource(getApplicationContext(), defaultUri);
            }

            mediaPlayer.setLooping(true); // Loop the adhan
            mediaPlayer.prepareAsync();

        } catch (IOException e) {
            Log.e(TAG, "Error initializing media player: " + e.getMessage());
            stopAdhan();
        }
    }

    @Override
    public void onPrepared(MediaPlayer mp) {
        Log.i(TAG, "MediaPlayer prepared, requesting focus...");
        requestAudioFocusAndStart();
    }

    private void requestAudioFocusAndStart() {
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC) // Matches media player attributes
                .build();

            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(this)
                .build();

            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                this,
                AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }

        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED || result == AudioManager.AUDIOFOCUS_REQUEST_DELAYED) {
            startPlayback();
        } else {
            Log.w(TAG, "Audio focus denied. Retrying once after 1s...");
            new Handler().postDelayed(this::startPlayback, 1000);
        }
    }

    private void startPlayback() {
        try {
            if (mediaPlayer != null && !isPlaying) {
                mediaPlayer.setVolume(1.0f, 1.0f);
                mediaPlayer.start();
                isPlaying = true;
                Log.i(TAG, "🕌 Adhan audio is now playing in the foreground");

                stopHandler.removeCallbacksAndMessages(null);
                stopHandler.postDelayed(() -> {
                    if (isPlaying) {
                        Log.i(TAG, "Max duration reached, stopping adhan");
                        stopAdhan();
                        stopSelf();
                    }
                }, ADHAN_MAX_DURATION);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting playback: " + e.getMessage());
            stopAdhan();
            stopSelf();
        }
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        Log.d(TAG, "Adhan playback completed");
        stopAdhan();
        stopSelf();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
        stopAdhan();
        stopSelf();
        return true;
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                stopAdhan();
                stopSelf();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    isPlaying = false;
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                if (mediaPlayer != null && !isPlaying) {
                    startPlayback();
                }
                break;
        }
    }

    private void stopAdhan() {
        if (isCleanedUp) {
            Log.d(TAG, "Already cleaned up, skipping");
            return;
        }
        isCleanedUp = true;
        
        isPlaying = false;
        
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                audioManager.abandonAudioFocus(this);
            }
        }

        releaseMediaPlayer();
        WakeLockHelper.release();

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }

        Log.i(TAG, "Adhan stopped and notification cleared");
    }

    private void releaseMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing media player: " + e.getMessage());
            }
            mediaPlayer = null;
        }
    }

    private Notification createNotification(String prayerName) {
        Intent stopIntent = new Intent(this, AdhanPlayerService.class);
        stopIntent.setAction("STOP_ADHAN");
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(prayerName + " Time")
            .setContentText("Adhan is playing... Tap to stop")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(stopPendingIntent)
            .setFullScreenIntent(contentIntent, true)
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop",
                stopPendingIntent
            );

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Adhan Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Prayer time alarms with Adhan sound");
            channel.enableVibration(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (volumeButtonReceiver != null) {
            try {
                unregisterReceiver(volumeButtonReceiver);
                Log.i(TAG, "Volume button receiver unregistered");
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "Receiver already unregistered");
            }
        }
        if (!isCleanedUp) {
            stopAdhan();
        }
        Log.d(TAG, "Service destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    private void registerVolumeButtonReceiver() {
        volumeButtonReceiver = new VolumeButtonReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction("android.media.VOLUME_CHANGED_ACTION");
        filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(volumeButtonReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(volumeButtonReceiver, filter);
        }
        Log.i(TAG, "Volume button receiver registered with high priority");
    }
    
    private class VolumeButtonReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!isPlaying) {
                return;
            }
            
            if (intent.getAction() != null && 
                intent.getAction().equals("android.media.VOLUME_CHANGED_ACTION")) {
                
                int streamType = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1);
                
                if (streamType == AudioManager.STREAM_ALARM || 
                    streamType == AudioManager.STREAM_MUSIC ||
                    streamType == AudioManager.STREAM_SYSTEM) {
                    
                    Log.i(TAG, "🛑 Volume button pressed - Stopping adhan immediately");
                    stopAdhan();
                    stopSelf();
                }
            }
        }
    }
}
