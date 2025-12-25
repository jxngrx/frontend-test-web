/**
 * Voice Call Component
 *
 * UI component for handling voice calls with WebRTC
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useVoiceCall, CallState } from '../hooks/useVoiceCall';
import { ChatSocket } from '../sockets/chatSocket';

interface VoiceCallComponentProps {
  callState: CallState;
  onInitiateCall: (receiverId: string) => void;
  onAnswerCall: (callId: string) => void;
  onRejectCall: (callId: string) => void;
  onEndCall: () => void;
  callerName?: string;
  receiverName?: string;
}

export default function VoiceCallComponent({
  callState,
  onInitiateCall,
  onAnswerCall,
  onRejectCall,
  onEndCall,
  callerName,
  receiverName,
}: VoiceCallComponentProps) {
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Update audio elements when streams change
  useEffect(() => {
    if (localAudioRef.current && callState.localStream) {
      localAudioRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteAudioRef.current && callState.remoteStream) {
      remoteAudioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (callState.status === 'connected' || callState.status === 'answered') {
      // Start timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      // Reset timer
      setCallDuration(0);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState.status]);

  // Mic level detection and animation
  useEffect(() => {
    if (callState.localStream && (callState.status === 'connected' || callState.status === 'answered')) {
      // Clean up any existing AudioContext first
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.warn('⚠️ [VOICECALL] Error closing existing AudioContext:', error);
        }
      }

      // Create audio context for analyzing mic input
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(callState.localStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMicLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          // Normalize to 0-100
          const level = Math.min(100, (average / 255) * 100);
          setMicLevel(level);

          animationFrameRef.current = requestAnimationFrame(updateMicLevel);
        }
      };

      updateMicLevel();
    } else {
      // Cleanup
      setMicLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.warn('⚠️ [VOICECALL] Error closing AudioContext:', error);
        }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.warn('⚠️ [VOICECALL] Error closing AudioContext in cleanup:', error);
        }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [callState.localStream, callState.status]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render anything if no active call
  if (callState.status === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-50 min-w-[300px]">
      {/* Hidden audio elements */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {/* Incoming call */}
      {callState.status === 'ringing' && callState.callerId && (
        <div className="text-center">
          <div className="text-lg font-semibold text-white mb-2">
            📞 Incoming Call
          </div>
          <div className="text-sm text-gray-300 mb-4">
            {callerName || 'Unknown User'}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => callState.callId && onAnswerCall(callState.callId)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Answer
            </button>
            <button
              onClick={() => callState.callId && onRejectCall(callState.callId)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Outgoing call (ringing) */}
      {callState.status === 'ringing' && !callState.callerId && (
        <div className="text-center">
          <div className="text-lg font-semibold text-white mb-2">
            📞 Calling...
          </div>
          <div className="text-sm text-gray-300 mb-4">
            {receiverName || 'Unknown User'}
          </div>
          <button
            onClick={onEndCall}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Call in progress */}
      {(callState.status === 'answered' || callState.status === 'connected') && (
        <div className="text-center">
          <div className="text-lg font-semibold text-white mb-2">
            📞 Call in Progress
          </div>
          <div className="text-sm text-gray-300 mb-2">
            {callState.callerId ? callerName : receiverName || 'Unknown User'}
          </div>

          {/* Call duration */}
          <div className="text-xs text-gray-400 mb-4 font-mono">
            {formatDuration(callDuration)}
          </div>

          {/* Mic animation */}
          {callState.localStream && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => {
                  const barHeight = micLevel > i * 20 ? Math.min(20, (micLevel - i * 20) * 1.5) : 2;
                  return (
                    <div
                      key={i}
                      className="w-1 bg-green-500 rounded-full transition-all duration-100"
                      style={{
                        height: `${barHeight}px`,
                        minHeight: '2px',
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-xs text-gray-400">Mic</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-4">
            {callState.localStream && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
            <span className="text-xs text-gray-400">Connected</span>
          </div>
          <button
            onClick={onEndCall}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
}
