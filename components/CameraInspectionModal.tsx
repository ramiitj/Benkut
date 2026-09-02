import React, { useRef, useState, useEffect, useCallback } from 'react';
import { speechSynthesizer } from '../services/speechSynthesizer';
import { useLanguage } from '../contexts/LanguageContext';
import { telemetryService } from '../services/telemetryService';
import { foodMemoryService } from '../services/foodMemoryService';
import { CulinaryEnvironment, CULINARY_ENVIRONMENTS } from '../services/environmentalGreetingEngine';
import { MutationMeta } from '../domain/foodMemory';

interface AutoTabulatedItem {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  storageLocation?: string;
  freshnessStatus?: string;
  target?: 'pantry' | 'shopping';
}

interface ShelfAnalysisResult {
  inStockAtHome?: string[];
  missingOrNeeded?: string[];
  recommendedPick?: string;
}

interface CameraInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (result: {
    specialist: string;
    speech: string;
    audioData?: string | null;
    produceAnalysis?: {
      name: string;
      freshnessScore: number;
      ripeness: string;
      storageTip: string;
      culinaryUse: string;
      wastePreventionTip?: string;
    };
    shelfAnalysis?: ShelfAnalysisResult;
    autoTabulatedItems?: AutoTabulatedItem[];
    workspace: { title: string; body: string };
    action?: { type: string; label: string; payload: Record<string, unknown> } | null;
    pullScreen?: string | null;
  }) => void;
  mode?: 'produce' | 'pantry' | 'auto';
  environment?: CulinaryEnvironment;
  voiceCommand?: string;
  onEnvironmentChange?: (env: CulinaryEnvironment) => void;
  /** Recent voice/text turns, so a camera-triggered analysis is aware of
   * what was just discussed (e.g. "these tomatoes look wrinkled" said
   * right before opening the camera) instead of starting from nothing. */
  history?: { role: 'user' | 'assistant'; text: string }[];
}

export const CameraInspectionModal: React.FC<CameraInspectionModalProps> = ({
  isOpen,
  onClose,
  onAnalysisComplete,
  mode = 'auto',
  environment = 'countertop',
  voiceCommand,
  onEnvironmentChange,
  history
}) => {
  const { t, language, langInfo } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Rear Camera (Live)');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Auto-Tabulation & Shelf Analysis Feedback States
  const [tabulationNotice, setTabulationNotice] = useState<string | null>(null);
  const [lastShelfAnalysis, setLastShelfAnalysis] = useState<ShelfAnalysisResult | null>(null);
  const [lastProduceAnalysis, setLastProduceAnalysis] = useState<any>(null);

  const getMutationMeta = (): MutationMeta => {
    let uid = 'guest';
    try {
      const savedUid = localStorage.getItem('benkut_auth_uid');
      if (savedUid) uid = savedUid;
    } catch {}
    return {
      actorUid: uid,
      householdId: uid,
      idempotencyKey: crypto.randomUUID(),
      source: 'photo'
    };
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const enumerateVideoDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
    } catch (e) {
      console.warn('Device enumeration notice:', e);
    }
  }, []);

  // Strict Rear-Camera Prioritization with Environment Constraints
  const startCamera = useCallback(async (facing: 'environment' | 'user' = currentFacingMode, deviceId?: string) => {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Constraints strictly prioritizing rear-facing camera
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: facing },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 }
            },
        audio: false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Primary rear camera constraints failed, attempting fallback:', firstErr);
        // Fallback to generic video if ideal environment fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCurrentFacingMode(facing);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const label = videoTrack.label || (facing === 'environment' ? 'Rear Lens (Environment)' : 'Front Lens');
        setActiveCameraLabel(label);
      }

      await enumerateVideoDevices();
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Camera is not accessible in this environment. You can upload an image directly.');
      setCameraActive(false);
    }
  }, [currentFacingMode, enumerateVideoDevices]);

  const toggleCameraFacing = useCallback(() => {
    const nextFacing = currentFacingMode === 'environment' ? 'user' : 'environment';
    void startCamera(nextFacing);
  }, [currentFacingMode, startCamera]);

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImage(dataUrl);
    stopCamera();
    return dataUrl;
  }, [stopCamera]);

  // Autonomous Item Auto-Tabulation Engine
  const executeAutonomousTabulation = useCallback((data: any) => {
    const meta = getMutationMeta();
    const tabulatedNames: string[] = [];

    // 1. Process explicit autoTabulatedItems array
    if (Array.isArray(data.autoTabulatedItems) && data.autoTabulatedItems.length > 0) {
      for (const item of data.autoTabulatedItems as AutoTabulatedItem[]) {
        if (!item.name) continue;
        const target = item.target || (environment === 'supermarket' ? 'shopping' : 'pantry');
        
        if (target === 'pantry') {
          foodMemoryService.addPantryLot(meta, {
            productId: item.name.toLowerCase().replace(/\W/g, '-'),
            name: item.name,
            category: item.category || 'produce',
            quantity: Number(item.quantity) || 1,
            reservedQuantity: 0,
            unit: (item.unit as any) || 'each',
            storageLocation: (item.storageLocation as any) || (environment === 'farm_market' || environment === 'countertop' ? 'refrigerator' : 'pantry'),
            freshnessStatus: (item.freshnessStatus as any) || 'fresh',
            freshnessConfidence: 0.92,
            freshnessEvidence: ['Autonomous rear-camera live scanner tabulation']
          });
        } else {
          foodMemoryService.addShoppingListItem(meta, {
            id: crypto.randomUUID(),
            name: item.name,
            reason: 'restock',
            desiredQuantity: Number(item.quantity) || 1,
            availableQuantity: 0,
            missingQuantity: Number(item.quantity) || 1,
            unit: (item.unit as any) || 'each',
            status: 'needed'
          });
        }
        tabulatedNames.push(item.name);
      }
    }
    // 2. Fallback: Autonomously tabulate single produce item if produceAnalysis is returned
    else if (data.produceAnalysis?.name) {
      const prod = data.produceAnalysis;
      const freshnessStatus = prod.ripeness === 'spoiled' ? 'expired' : prod.ripeness === 'overripe' ? 'use-first' : 'fresh';
      
      foodMemoryService.addPantryLot(meta, {
        productId: prod.name.toLowerCase().replace(/\W/g, '-'),
        name: prod.name,
        category: 'produce',
        quantity: 1,
        reservedQuantity: 0,
        unit: 'each',
        storageLocation: 'refrigerator',
        freshnessStatus,
        freshnessConfidence: (prod.freshnessScore || 90) / 100,
        freshnessEvidence: ['Autonomous rear-camera produce analysis']
      });
      tabulatedNames.push(prod.name);
    }
    // 3. Fallback: Execute action payload autonomously if action is present
    else if (data.action?.type === 'add_pantry' && data.action?.payload?.name) {
      const p = data.action.payload;
      foodMemoryService.addPantryLot(meta, {
        productId: String(p.name).toLowerCase().replace(/\W/g, '-'),
        name: String(p.name),
        category: String(p.category || 'produce'),
        quantity: Number(p.quantity) || 1,
        reservedQuantity: 0,
        unit: (p.unit as any) || 'each',
        storageLocation: (p.storageLocation as any) || 'refrigerator',
        freshnessStatus: 'fresh',
        freshnessConfidence: 0.9,
        freshnessEvidence: ['Autonomous camera action execution']
      });
      tabulatedNames.push(String(p.name));
    } else if (data.action?.type === 'add_shopping' && data.action?.payload?.name) {
      const p = data.action.payload;
      foodMemoryService.addShoppingListItem(meta, {
        id: crypto.randomUUID(),
        name: String(p.name),
        reason: 'meal-plan',
        desiredQuantity: Number(p.quantity) || 1,
        availableQuantity: 0,
        missingQuantity: Number(p.quantity) || 1,
        unit: 'each',
        status: 'needed'
      });
      tabulatedNames.push(String(p.name));
    }

    if (tabulatedNames.length > 0) {
      setTabulationNotice(`⚡ Auto-tabulated ${tabulatedNames.join(', ')} into kitchen memory`);
    }

    return tabulatedNames;
  }, [environment]);

  const submitDirectImage = useCallback(async (imageDataUrl: string) => {
    setAnalyzing(true);
    setTabulationNotice(null);
    speechSynthesizer.speakText(
      language === 'Español' ? 'Escaneando con cámara trasera...' :
      language === 'हिन्दी' ? 'कैमरा से स्कैन किया जा रहा है...' :
      language === 'Français' ? 'Analyse en direct par caméra...' :
      language === 'తెలుగు' ? 'కెమెరాతో స్కాన్ చేస్తోంది...' :
      'Scanning with rear camera...'
    );

    telemetryService.logEvent('camera_scan', {
      language,
      details: { mode, environment, lens: currentFacingMode }
    });
    
    try {
      const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = imageDataUrl.split(',')[1];
      const memoryState = foodMemoryService.getState();

      const envConfig = CULINARY_ENVIRONMENTS[environment];
      const envLabel = envConfig?.translations[language]?.label || envConfig?.translations?.English?.label || 'Kitchen';

      const promptText = `Rear-camera food visual inspection. 
Current Culinary Location: ${environment} (${envLabel}).
Home Pantry Context: ${JSON.stringify(memoryState?.pantryLots?.map(l => ({ name: l.name, remaining: l.remainingQuantity, status: l.freshnessStatus })) || [])}
Active Shopping List: ${JSON.stringify(memoryState?.shoppingList?.map(i => ({ name: i.name, status: i.status })) || [])}

TASK:
1. If this is a Market Shelf or Grocery Aisle (environment is supermarket/farm_market or shelf visual):
   - Identify all visible items on the shelf.
   - Cross-reference with the user's home pantry inventory.
   - Fill "shelfAnalysis" with "inStockAtHome" (items user already has), "missingOrNeeded" (items user is out of or on shopping list), and "recommendedPick" (best quality items to buy).
   - Autonomously populate "autoTabulatedItems" with any needed items to record.
2. If this is Fresh Produce (fruits, vegetables, herbs):
   - Evaluate "produceAnalysis" with freshnessScore (0-100), ripeness, storage advice, and food waste prevention tip.
   - Autonomously populate "autoTabulatedItems" with the fresh item so it saves into the pantry.
3. If this is a Home Pantry Shelf or Fridge:
   - Identify all items and auto-tabulate them into "autoTabulatedItems" for the home pantry.

Provide a friendly, warm spoken response in ${language} (${langInfo.bcp47}).`;

      const response = await fetch('/api/agent/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          language,
          bcp47: langInfo.bcp47,
          environment,
          history: (history || []).slice(-12),
          historySummary: (memoryState?.memoryNotes || []).join(' | '),
          context: memoryState,
          voiceGender: speechSynthesizer.getVoiceGender(),
          image: { mimeType, data: base64Data }
        })
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(response.ok ? 'Inspection returned an unexpected format' : `Server connection error (${response.status})`);
      }
      if (!response.ok) throw new Error(data?.error || 'Inspection could not complete');

      // Execute Autonomous Auto-Tabulation without requiring manual clicks
      executeAutonomousTabulation(data);

      if (data.shelfAnalysis) {
        setLastShelfAnalysis(data.shelfAnalysis);
      }
      if (data.produceAnalysis) {
        setLastProduceAnalysis(data.produceAnalysis);
      }

      onAnalysisComplete(data);

      // Autonomous Screen Dismissal if AI commands close or user confirmed
      if (data.pullScreen === 'close' || data.cameraCommand === 'close') {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error) {
      console.error('Inspection error:', error);
      speechSynthesizer.speakText('Could not complete image scan. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [language, langInfo.bcp47, mode, environment, currentFacingMode, executeAutonomousTabulation, onAnalysisComplete, onClose, history]);

  // Voice Command Listener inside Camera Modal
  useEffect(() => {
    if (!isOpen || !voiceCommand) return;
    const cmd = voiceCommand.toLowerCase().trim();

    // Autonomous Screen Dismissal when user confirms scanning is complete
    if (/^(close|exit|back|done|done scanning|complete|finished|scanning complete|that's all|stop camera|बंद करें|మూసివేయి|పూర్తయింది|cerrar|listo|terminé|fermer)$/i.test(cmd)) {
      speechSynthesizer.speakText(
        language === 'Español' ? 'Escaneo completado. Volviendo a la cocina.' :
        language === 'हिन्दी' ? 'स्कैन पूरा हुआ। रसोई में वापस जा रहे हैं।' :
        language === 'Français' ? 'Numérisation terminée. Retour en cuisine.' :
        language === 'తెలుగు' ? 'స్కానింగ్ పూర్తయింది. వంటగదికి తిరిగి వెళ్తున్నాము.' :
        'Scanning complete. Returning to kitchen.'
      );
      onClose();
      return;
    }

    // Voice Capture / Snap Commands
    if (/^(take photo|capture|snap|take picture|click photo|inspect this|check it|scan this|how does it look|analyze|तस्वीर लें|ఫోటో తీయండి|tomar foto|prendre photo)$/i.test(cmd)) {
      if (cameraActive) {
        const snapped = capturePhoto();
        if (snapped) void submitDirectImage(snapped);
      } else if (capturedImage) {
        void submitDirectImage(capturedImage);
      }
    }
  }, [isOpen, voiceCommand, cameraActive, capturedImage, capturePhoto, submitDirectImage, onClose, language]);

  useEffect(() => {
    if (isOpen) {
      startCamera('environment');
    } else {
      stopCamera();
      setCapturedImage(null);
      setCameraError('');
      setAnalyzing(false);
      setTabulationNotice(null);
      setLastShelfAnalysis(null);
      setLastProduceAnalysis(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
        void submitDirectImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div id="camera-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-fade-in overscroll-contain">
      <div id="camera-modal-card" className="relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] sm:rounded-[32px] bg-stone-950 text-white shadow-2xl border border-stone-800">
        
        {/* Top Navigation & Status Bar */}
        <div className="flex items-center justify-between border-b border-stone-800 bg-stone-950 px-4 sm:px-5 py-3 sm:py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#174F35] text-[#DFF36C] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">videocam</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white leading-tight truncate">Live Scanner HUD</h2>
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Rear Lens
                </span>
              </div>
              <span className="text-[10px] text-stone-400 block font-medium truncate">
                {activeCameraLabel} • Auto-Tabulation Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Camera Switch / Flip Button */}
            <button
              id="camera-modal-flip-btn"
              onClick={toggleCameraFacing}
              disabled={analyzing}
              className="w-8 h-8 rounded-full bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="Switch Front/Rear Camera"
              aria-label="Switch Front/Rear Camera"
            >
              <span className="material-symbols-outlined text-sm">flip_camera_ios</span>
            </button>

            {/* Close Button */}
            <button
              id="camera-modal-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition flex items-center justify-center cursor-pointer"
              aria-label={t('close')}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Location / Context Quick Bar */}
        {onEnvironmentChange && (
          <div className="bg-stone-900/80 px-3 py-1.5 border-b border-stone-800 flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-1.5">
            <span className="text-[10px] uppercase font-bold text-stone-400 shrink-0">Mode:</span>
            <div className="flex items-center gap-1">
              {(['countertop', 'pantry', 'supermarket', 'farm_market'] as CulinaryEnvironment[]).map((envKey) => {
                const item = CULINARY_ENVIRONMENTS[envKey];
                const isSelected = environment === envKey;
                return (
                  <button
                    key={envKey}
                    type="button"
                    onClick={() => onEnvironmentChange(envKey)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-[#174F35] text-[#DFF36C] border border-[#DFF36C]/40'
                        : 'bg-stone-800 text-stone-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">{item.icon}</span>
                    <span>{item.translations[language]?.label || item.translations.English.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Viewfinder with HUD & Laser Scanning Reticle */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[50dvh] overflow-hidden select-none">
          {analyzing ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center animate-pulse">
              <div className="w-14 h-14 rounded-full border-4 border-[#DFF36C] border-t-transparent animate-spin" />
              <p className="text-sm font-bold text-white">Evaluating food visual with AI...</p>
              <p className="text-xs text-stone-400">Cross-referencing home pantry & auto-tabulating</p>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img src={capturedImage} alt="Captured" className="h-full w-full object-contain max-h-[48dvh]" />
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-[10px] text-white font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#DFF36C]">check_circle</span>
                <span>Frame Captured</span>
              </div>
            </div>
          ) : cameraActive ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover max-h-[48dvh]"
              />
              
              {/* Dynamic Laser Scanning Line */}
              <div className="animate-laser-scan" />

              {/* HUD Corner Reticles */}
              <div className="absolute inset-5 sm:inset-7 pointer-events-none flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-[#DFF36C] rounded-tl-lg shadow-[0_0_8px_rgba(223,243,108,0.6)]" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-[#DFF36C] rounded-tr-lg shadow-[0_0_8px_rgba(223,243,108,0.6)]" />
                </div>
                {/* Center Crosshair */}
                <div className="self-center flex flex-col items-center gap-1">
                  <div className="w-12 h-12 border border-white/30 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-xs">
                    <span className="material-symbols-outlined text-[#DFF36C] text-sm opacity-80">crop_free</span>
                  </div>
                  <span className="text-[9px] font-extrabold tracking-wider text-white/80 uppercase bg-black/60 px-2 py-0.5 rounded-full border border-white/15">
                    {environment === 'supermarket' || environment === 'farm_market' ? 'Market Shelf Scanner' : 'Produce & Pantry Guard'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-[#DFF36C] rounded-bl-lg shadow-[0_0_8px_rgba(223,243,108,0.6)]" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-[#DFF36C] rounded-br-lg shadow-[0_0_8px_rgba(223,243,108,0.6)]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-stone-400">
              <span className="material-symbols-outlined text-4xl mb-2 text-stone-500">videocam_off</span>
              <p className="text-xs mb-3 text-stone-400">{cameraError || 'Camera inactive'}</p>
              <button
                onClick={() => startCamera('environment')}
                className="rounded-xl bg-stone-800 px-4 py-2 text-xs font-bold text-white hover:bg-stone-700 cursor-pointer"
              >
                Retry Rear Camera
              </button>
            </div>
          )}

          {/* Real-time Voice Prompt Badge */}
          {cameraActive && !analyzing && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/15 text-[10px] text-stone-200 font-bold flex items-center gap-2 pointer-events-none shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Say "Snap" to scan • "Done" to exit</span>
            </div>
          )}
        </div>

        {/* Real-Time Auto-Tabulation & Shelf Analysis HUD Notification */}
        {tabulationNotice && (
          <div className="bg-emerald-950 border-t border-emerald-600/40 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-emerald-400 text-sm shrink-0">inventory_2</span>
              <span className="font-bold text-[11px] truncate">{tabulationNotice}</span>
            </div>
            <span className="text-[9px] uppercase font-extrabold bg-emerald-800/60 text-emerald-300 px-1.5 py-0.5 rounded-sm shrink-0 ml-2">
              AUTONOMOUS
            </span>
          </div>
        )}

        {/* Market Shelf Cross-Referencing Overlay Banner */}
        {lastShelfAnalysis && (
          <div className="bg-stone-900 border-t border-stone-800 px-4 py-2 text-left space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-[#DFF36C]">Market Shelf vs Home Pantry:</span>
              <span className="text-[9px] text-stone-400 font-medium">Cross-Referenced</span>
            </div>
            {lastShelfAnalysis.inStockAtHome && lastShelfAnalysis.inStockAtHome.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="material-symbols-outlined text-xs text-emerald-400">check_circle</span>
                <span>Already at home: {lastShelfAnalysis.inStockAtHome.join(', ')}</span>
              </div>
            )}
            {lastShelfAnalysis.missingOrNeeded && lastShelfAnalysis.missingOrNeeded.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
                <span className="material-symbols-outlined text-xs text-amber-400">add_shopping_cart</span>
                <span>Missing / Need: {lastShelfAnalysis.missingOrNeeded.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Controls & Shutter Dock */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-stone-950 px-5 py-3.5 sm:py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            id="camera-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-xl bg-stone-900 border border-stone-800 px-3.5 py-2.5 text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
            title="Upload image file"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Large Shutter Button */}
          <button
            id="camera-shutter-btn"
            onClick={() => {
              if (cameraActive) {
                const snapped = capturePhoto();
                if (snapped) void submitDirectImage(snapped);
              } else if (capturedImage) {
                void submitDirectImage(capturedImage);
              } else {
                startCamera('environment');
              }
            }}
            disabled={analyzing}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#174F35] text-[#DFF36C] ring-4 ring-[#DFF36C]/40 transition active:scale-90 hover:bg-[#0E3826] cursor-pointer disabled:opacity-50 shadow-lg"
            title="Capture & Auto-Tabulate"
          >
            <span className="material-symbols-outlined text-2xl">
              {capturedImage ? 'check' : 'photo_camera'}
            </span>
          </button>

          {/* Done / Reset Button */}
          <button
            id="camera-done-btn"
            onClick={() => {
              if (capturedImage) {
                setCapturedImage(null);
                startCamera('environment');
              } else {
                onClose();
              }
            }}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-xl bg-stone-900 border border-stone-800 px-3.5 py-2.5 text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
            title={capturedImage ? 'Retake Photo' : 'Complete Scanning'}
          >
            <span className="material-symbols-outlined text-base">
              {capturedImage ? 'refresh' : 'check'}
            </span>
            <span className="hidden sm:inline">{capturedImage ? 'Retake' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

