/**
 * React Hook for Voice Calling
 *
 * Manages WebRTC peer connection, media streams, and call state
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatSocket, RTCConfiguration } from '../sockets/chatSocket';
import { initiateCall, answerCall, rejectCall, endCall } from '../api/calls';

export interface CallState {
  callId: string | null;
  callerId: string | null;
  receiverId: string | null;
  status: 'idle' | 'ringing' | 'answered' | 'connected' | 'ended';
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

export function useVoiceCall(socket: ChatSocket | null, token: string | null) {
  const [callState, setCallState] = useState<CallState>({
    callId: null,
    callerId: null,
    receiverId: null,
    status: 'idle',
    remoteStream: null,
    localStream: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isCallerRef = useRef<boolean>(false);
  const rtcConfigRef = useRef<RTCConfiguration | null>(null);
  const callStateRef = useRef<CallState>(callState);
  const handleEndCallRef = useRef<(() => Promise<void>) | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef<boolean>(false);

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Initialize WebRTC Peer Connection
  const initPeerConnection = useCallback((rtcConfig: RTCConfiguration) => {
    if (pcRef.current) {
      console.log('🔄 [VOICECALL] Closing existing peer connection');
      pcRef.current.close();
    }

    // Reset state
    iceCandidateQueueRef.current = [];
    remoteDescriptionSetRef.current = false;

    console.log('🔌 [VOICECALL] Creating new peer connection with config:', rtcConfig);
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎵 [VOICECALL] Remote stream received:', {
        tracks: event.streams[0]?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })),
        streamId: event.streams[0]?.id,
      });
      setCallState((prev) => ({ ...prev, remoteStream: event.streams[0] }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const currentCallState = callStateRef.current;
        const targetId = currentCallState.receiverId || currentCallState.callerId;
        if (targetId && currentCallState.callId) {
          console.log('🧊 [VOICECALL] Sending ICE candidate:', {
            callId: currentCallState.callId,
            targetId,
            candidate: event.candidate.candidate?.substring(0, 50),
          });
          socket.emitICECandidate(currentCallState.callId, event.candidate.toJSON(), targetId);
        } else {
          console.warn('⚠️ [VOICECALL] Cannot send ICE candidate - missing targetId or callId');
        }
      } else if (event.candidate === null) {
        console.log('🧊 [VOICECALL] ICE gathering complete');
      }
    };

    // Handle ICE connection state (separate from peer connection state)
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 [VOICECALL] ICE connection state:', pc.iceConnectionState);

      switch (pc.iceConnectionState) {
        case 'failed':
          console.error('❌ [VOICECALL] ICE connection failed, attempting restart');
          // Try ICE restart
          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
            pc.createOffer({ iceRestart: true })
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                // Resend offer with ICE restart
                const currentCallState = callStateRef.current;
                const targetId = currentCallState.receiverId || currentCallState.callerId;
                if (socket && currentCallState.callId && targetId && pc.localDescription) {
                  console.log('🔄 [VOICECALL] Resending offer with ICE restart');
                  socket.emitWebRTCOffer(
                    currentCallState.callId,
                    pc.localDescription.toJSON(),
                    targetId
                  );
                }
              })
              .catch(err => console.error('❌ [VOICECALL] Error during ICE restart:', err));
          }
          break;
        case 'disconnected':
          console.warn('⚠️ [VOICECALL] ICE connection disconnected');
          break;
        case 'connected':
        case 'completed':
          console.log('✅ [VOICECALL] ICE connection established');
          break;
        case 'checking':
          console.log('🔄 [VOICECALL] ICE connection checking...');
          break;
        default:
          console.log(`ℹ️ [VOICECALL] ICE connection state: ${pc.iceConnectionState}`);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 [VOICECALL] Peer connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.error('❌ [VOICECALL] Connection failed, ending call');
        if (handleEndCallRef.current) {
          handleEndCallRef.current();
        }
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠️ [VOICECALL] Connection disconnected - may reconnect');
        // Don't end call on disconnected, it may reconnect
      } else if (pc.connectionState === 'connected') {
        console.log('✅ [VOICECALL] Connection established');
      }
    };

    // Add local stream tracks if available
    if (localStreamRef.current) {
      console.log('🎤 [VOICECALL] Adding local stream tracks to peer connection');
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
        console.log('✅ [VOICECALL] Added track:', track.kind, track.id);
      });
    } else {
      console.log('ℹ️ [VOICECALL] Local stream not yet available, tracks will be added when stream is ready');
    }
  }, [socket]);

  // Get user media
  const getLocalStream = useCallback(async () => {
    try {
      console.log('🎤 [VOICECALL] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false, // Voice only
      });

      console.log('✅ [VOICECALL] Microphone access granted:', {
        tracks: stream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
      });

      localStreamRef.current = stream;
      setCallState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection if it exists
      if (pcRef.current) {
        console.log('🎤 [VOICECALL] Adding tracks to existing peer connection');
        stream.getTracks().forEach((track) => {
          // Check if track is already added
          const senders = pcRef.current?.getSenders() || [];
          const alreadyAdded = senders.some(sender => sender.track === track);

          if (!alreadyAdded) {
            pcRef.current?.addTrack(track, stream);
            console.log('✅ [VOICECALL] Added track to peer connection:', track.kind, track.id);
          } else {
            console.log('ℹ️ [VOICECALL] Track already added:', track.kind, track.id);
          }
        });
      } else {
        console.log('ℹ️ [VOICECALL] Peer connection not yet created, tracks will be added when PC is created');
      }

      return stream;
    } catch (error) {
      console.error('❌ [VOICECALL] Error accessing microphone:', error);
      throw error;
    }
  }, []);

  // Cleanup WebRTC resources (internal helper)
  const cleanupWebRTCResources = useCallback(() => {
    console.log('🧹 [VOICECALL] Cleaning up WebRTC resources');

    // Close peer connection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (error) {
        console.warn('⚠️ [VOICECALL] Error closing peer connection:', error);
      }
      pcRef.current = null;
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn('⚠️ [VOICECALL] Error stopping track:', error);
        }
      });
      localStreamRef.current = null;
    }

    // Reset state
    setCallState({
      callId: null,
      callerId: null,
      receiverId: null,
      status: 'idle',
      remoteStream: null,
      localStream: null,
    });
    rtcConfigRef.current = null;
    iceCandidateQueueRef.current = [];
    remoteDescriptionSetRef.current = false;
  }, []);

  // End call handler (calls API to end call)
  const handleEndCall = useCallback(async () => {
    const callId = callStateRef.current.callId;

    try {
      // Only call API if we have a callId and token
      if (callId && token) {
        console.log('📞 [VOICECALL] Ending call via API:', callId);
        try {
          await endCall(token, callId);
          console.log('✅ [VOICECALL] Call ended via API successfully');
        } catch (error: any) {
          // If API call fails (e.g., call already ended), still cleanup locally
          console.warn('⚠️ [VOICECALL] API call to end call failed (may already be ended):', error?.message);
        }
      } else {
        console.log('📞 [VOICECALL] Ending call locally (no API call needed)');
      }
    } catch (error) {
      console.error('❌ [VOICECALL] Error in handleEndCall:', error);
    } finally {
      // Always cleanup resources regardless of API call result
      cleanupWebRTCResources();
    }
  }, [token, cleanupWebRTCResources]);

  // Keep handleEndCall ref in sync
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  // Initiate call
  const initiateCallHandler = useCallback(
    async (receiverId: string) => {
      if (!token || !socket) {
        console.error('❌ [VOICECALL] Cannot initiate call: Missing token or socket');
        return;
      }

      try {
        isCallerRef.current = true;

        // Initiate call via REST API
        const call = await initiateCall(token, receiverId);
        console.log('📞 [VOICECALL] Call initiated:', call);

        setCallState((prev) => ({
          ...prev,
          callId: call.id,
          receiverId,
          status: 'ringing',
        }));

        // Get local stream first
        await getLocalStream();

        // Setup WebRTC with default config (will be updated if backend sends rtcConfig)
        const defaultRTCConfig: RTCConfiguration = {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };

        // Initialize peer connection (tracks will be added automatically if localStreamRef is set)
        initPeerConnection(defaultRTCConfig);

        // Ensure tracks are added (in case peer connection was created before stream)
        if (pcRef.current && localStreamRef.current) {
          const senders = pcRef.current.getSenders();
          localStreamRef.current.getTracks().forEach((track) => {
            const alreadyAdded = senders.some(sender => sender.track === track);
            if (!alreadyAdded) {
              console.log('🎤 [VOICECALL] Adding track before creating offer:', track.kind);
              pcRef.current?.addTrack(track, localStreamRef.current!);
            }
          });
        }

        // Create and send offer
        if (pcRef.current) {
          console.log('📞 [VOICECALL] Creating offer...');
          const offer = await pcRef.current.createOffer();
          console.log('📞 [VOICECALL] Offer created, setting local description...');
          await pcRef.current.setLocalDescription(offer);
          console.log('📞 [VOICECALL] Sending offer to receiver:', receiverId);
          socket.emitWebRTCOffer(call.id, offer, receiverId);
        } else {
          console.error('❌ [VOICECALL] Peer connection not available when creating offer');
        }
      } catch (error) {
        console.error('❌ [VOICECALL] Error initiating call:', error);
        setCallState((prev) => ({ ...prev, status: 'idle' }));
      }
    },
    [token, socket, getLocalStream, initPeerConnection]
  );

  // Answer call
  const answerCallHandler = useCallback(
    async (callId: string) => {
      if (!token || !socket) {
        console.error('❌ [VOICECALL] Cannot answer call: Missing token or socket');
        return;
      }

      try {
        isCallerRef.current = false;

        // Get local stream first
        await getLocalStream();

        // Initialize peer connection (receiver side)
        // Use rtcConfig if available, otherwise default
        const config = rtcConfigRef.current || {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };
        initPeerConnection(config);

        // Answer via REST API
        await answerCall(token, callId);
        console.log('📞 [VOICECALL] Call answered:', callId);

        setCallState((prev) => ({
          ...prev,
          callId,
          status: 'answered',
        }));

        // Note: We'll handle the offer when it arrives via socket
        // The peer connection is ready to receive the offer
      } catch (error) {
        console.error('❌ [VOICECALL] Error answering call:', error);
      }
    },
    [token, socket, getLocalStream, initPeerConnection]
  );

  // Reject call
  const rejectCallHandler = useCallback(
    async (callId: string) => {
      if (!token) {
        console.error('❌ [VOICECALL] Cannot reject call: Missing token');
        return;
      }

      try {
        await rejectCall(token, callId);
        console.log('📞 [VOICECALL] Call rejected:', callId);
        setCallState((prev) => ({ ...prev, status: 'idle', callId: null }));
      } catch (error) {
        console.error('❌ [VOICECALL] Error rejecting call:', error);
      }
    },
    [token]
  );

  // Setup Socket.IO listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    const handleCallIncoming = async (data: {
      callId: string;
      callerId: string;
      rtcConfig?: RTCConfiguration;
    }) => {
      console.log('📞 [VOICECALL] Incoming call:', data);
      setCallState((prev) => ({
        ...prev,
        callId: data.callId,
        callerId: data.callerId,
        status: 'ringing',
      }));
      if (data.rtcConfig) {
        rtcConfigRef.current = data.rtcConfig;
      }
    };

    // Call initiated (caller confirmation)
    const handleCallInitiated = (data: {
      callId: string;
      receiverId: string;
      rtcConfig?: RTCConfiguration;
    }) => {
      console.log('📞 [VOICECALL] Call initiated:', data);
      setCallState((prev) => ({
        ...prev,
        callId: data.callId,
        receiverId: data.receiverId,
      }));
      if (data.rtcConfig) {
        rtcConfigRef.current = data.rtcConfig;
        initPeerConnection(data.rtcConfig);
      }
    };

    // Call answered (caller receives this)
    const handleCallAnswered = (data: { callId: string; receiverId?: string }) => {
      console.log('📞 [VOICECALL] Call answered event received:', data);
      setCallState((prev) => {
        // Only update if this is the current call
        if (prev.callId === data.callId) {
          return { ...prev, status: 'answered' };
        }
        return prev;
      });
    };

    // Call connected (receiver receives this)
    const handleCallConnected = (data: { callId: string; callerId?: string }) => {
      console.log('📞 [VOICECALL] Call connected:', data);
      setCallState((prev) => ({ ...prev, status: 'connected' }));
    };

    // Call rejected
    const handleCallRejected = (data: { callId: string }) => {
      console.log('📞 [VOICECALL] Call rejected:', data);
      setCallState((prev) => ({ ...prev, status: 'idle', callId: null }));
    };

    // Call ended (received from other side - don't call API, just cleanup)
    const handleCallEnded = (data: { callId: string; endedBy: string }) => {
      console.log('📞 [VOICECALL] Call ended event received:', {
        callId: data.callId,
        endedBy: data.endedBy,
        currentCallId: callStateRef.current.callId,
      });

      // Verify this is for the current call
      if (callStateRef.current.callId !== data.callId) {
        console.warn('⚠️ [VOICECALL] Received call:ended for different call, ignoring');
        return;
      }

      // Just cleanup locally - don't call API (other side already did)
      console.log('🧹 [VOICECALL] Cleaning up after remote call end');
      cleanupWebRTCResources();
    };

    // Helper function to flush queued ICE candidates
    const flushIceCandidateQueue = async () => {
      if (!pcRef.current || !remoteDescriptionSetRef.current) return;

      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        if (candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ [VOICECALL] Added queued ICE candidate');
          } catch (error) {
            console.error('❌ [VOICECALL] Error adding queued ICE candidate:', error);
          }
        }
      }
    };

    // WebRTC Offer (receiver receives)
    const handleWebRTCOffer = async (data: {
      callId: string;
      offer: RTCSessionDescriptionInit;
      callerId: string;
    }) => {
      console.log('📞 [VOICECALL] WebRTC offer received:', data.callId);

      try {
        // Ensure peer connection exists (should be created when answering, but handle race condition)
        if (!pcRef.current) {
          console.log('📞 [VOICECALL] Peer connection not found, creating...');
          const config = rtcConfigRef.current || {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          };
          initPeerConnection(config);

          // Get local stream if not already available
          if (!callState.localStream) {
            await getLocalStream();
          }
        }

        if (pcRef.current) {
          console.log('📞 [VOICECALL] Setting remote description (offer)...');
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          remoteDescriptionSetRef.current = true;
          console.log('✅ [VOICECALL] Remote description set (offer)');

          // Now flush any queued ICE candidates
          await flushIceCandidateQueue();

          console.log('📞 [VOICECALL] Creating answer...');
          const answer = await pcRef.current.createAnswer();

          console.log('📞 [VOICECALL] Setting local description (answer)...');
          await pcRef.current.setLocalDescription(answer);

          if (socket) {
            console.log('📞 [VOICECALL] Sending WebRTC answer to caller:', {
              callId: data.callId,
              callerId: data.callerId,
            });
            socket.emitWebRTCAnswer(data.callId, answer, data.callerId);

            // Update state to connected after sending answer
            setCallState((prev) => {
              if (prev.callId === data.callId) {
                return { ...prev, status: 'connected' };
              }
              return prev;
            });
          }
        } else {
          console.error('❌ [VOICECALL] Peer connection still not available after initialization');
        }
      } catch (error) {
        console.error('❌ [VOICECALL] Error handling WebRTC offer:', error);
      }
    };

    // WebRTC Answer (caller receives)
    const handleWebRTCAnswer = async (data: {
      callId: string;
      answer: RTCSessionDescriptionInit;
      receiverId: string;
    }) => {
      console.log('📞 [VOICECALL] WebRTC answer received:', {
        callId: data.callId,
        receiverId: data.receiverId,
        currentCallId: callStateRef.current.callId,
      });

      try {
        // Verify this answer is for the current call
        if (callStateRef.current.callId !== data.callId) {
          console.warn('⚠️ [VOICECALL] Received answer for different call, ignoring');
          return;
        }

        if (pcRef.current) {
          console.log('📞 [VOICECALL] Setting remote description (answer)...');
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          remoteDescriptionSetRef.current = true;
          console.log('✅ [VOICECALL] Remote description set (answer)');

          // Update call state to connected when answer is received
          setCallState((prev) => {
            if (prev.callId === data.callId) {
              return { ...prev, status: 'connected' };
            }
            return prev;
          });

          // Now flush any queued ICE candidates
          await flushIceCandidateQueue();
        } else {
          console.error('❌ [VOICECALL] Peer connection not available when receiving answer');
        }
      } catch (error) {
        console.error('❌ [VOICECALL] Error handling WebRTC answer:', error);
      }
    };

    // ICE Candidate handler - QUEUE if remote description not set
    const handleICECandidate = async (data: {
      callId: string;
      candidate: RTCIceCandidateInit | null;
      senderId: string;
    }) => {
      // Ignore null candidates (end of candidates)
      if (!data.candidate) {
        return;
      }

      if (!pcRef.current) {
        console.warn('⚠️ [VOICECALL] Received ICE candidate but peer connection not initialized');
        return;
      }

      // If remote description is not set yet, queue the candidate
      if (!remoteDescriptionSetRef.current) {
        console.log('📦 [VOICECALL] Queueing ICE candidate (remote description not set yet)');
        iceCandidateQueueRef.current.push(data.candidate);
        return;
      }

      // Otherwise, add immediately
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ [VOICECALL] Added ICE candidate');
      } catch (error) {
        console.error('❌ [VOICECALL] Error adding ICE candidate:', error);
      }
    };

    // Error handling
    const handleCallError = (error: { message: string }) => {
      console.error('❌ [VOICECALL] Call error:', error);
      setCallState((prev) => ({ ...prev, status: 'idle' }));
    };

    // Register listeners
    socket.onCallIncoming = handleCallIncoming;
    socket.onCallInitiated = handleCallInitiated;
    socket.onCallAnswered = handleCallAnswered;
    socket.onCallConnected = handleCallConnected;
    socket.onCallRejected = handleCallRejected;
    socket.onCallEnded = handleCallEnded;
    socket.onCallWebRTCOffer = handleWebRTCOffer;
    socket.onCallWebRTCAnswer = handleWebRTCAnswer;
    socket.onCallWebRTCICECandidate = handleICECandidate;
    socket.onCallError = handleCallError;

    return () => {
      // Cleanup is handled by socket's internal event system
    };
  }, [socket, initPeerConnection, handleEndCall, cleanupWebRTCResources]);

  return {
    callState,
    initiateCall: initiateCallHandler,
    answerCall: answerCallHandler,
    rejectCall: rejectCallHandler,
    endCall: handleEndCall,
  };
}
