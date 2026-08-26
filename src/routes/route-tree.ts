import { arIndexRoute } from './ar-index';
import { arImageCompressorRoute } from './ar-image-compressor';
import { arQuickFlowRoute } from './ar-quickflow';
import { enImageCompressorRoute } from './en-image-compressor';
import { enQuickFlowRoute } from './en-quickflow';
import { enPdfCompressorRoute, enPdfMergerSplitterRoute, enImageToPdfRoute, enPdfUnlockProtectRoute, enPdfToTextRoute } from './pdf-tools';
import { enWordCharacterCounterRoute } from './word-tools';
import { enTextDiffCheckerRoute } from './text-tools';
import { enCaseConverterRoute } from './case-tools';
import { enQrGeneratorReaderRoute } from './qr-tools';
import { enPasswordGeneratorRoute } from './password-tools';
import { enAspectRatioCalculatorRoute } from './aspect-ratio-tools';
import { enJsonFormatterValidatorRoute } from './json-tools';
import { enBase64EncoderDecoderRoute } from './base64-tools';
import { enColorPickerPaletteRoute } from './color-tools';
import { enVideoTrimmerSplitterRoute } from './video-tools';
import { enAudioExtractorMuterRoute } from './audio-tools';
import { enVideoGifMemeRoute } from './video-gif-meme';
import { enVideoCompressorConverterRoute } from './video-compressor-converter';
import { enAiCaptionerSrtRoute } from './ai-captioner-srt';
import { enAudioCutterTrimmerRoute } from './audio-cutter-trimmer';
import { enAiVocalInstrumentalRemoverRoute } from './ai-vocal-instrumental-remover';
import { enAudioCompressorRoute } from './audio-compressor';
import { enAudioNoiseReducerRoute } from './audio-noise-reducer';
import { enRegexTesterRoute } from './regex-tools';
import { enHashGeneratorRoute } from './hash-generator';
import { localizedHomeRoute } from './localized-home';
import { localizedQuickFlowRoute } from './localized-quickflow';
import { imageToolRoutes } from './image-tools';
import { indexRoute } from './index';
import { localizedToolRoute } from './localized-tool';
import { useCaseRoute } from './use-case';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  enImageCompressorRoute,
  arImageCompressorRoute,
  enQuickFlowRoute,
  arQuickFlowRoute,
  localizedQuickFlowRoute,
  useCaseRoute,
  enPdfMergerSplitterRoute,
  enPdfCompressorRoute,
  enImageToPdfRoute,
  enPdfUnlockProtectRoute,
  enPdfToTextRoute,
  enWordCharacterCounterRoute,
  enTextDiffCheckerRoute,
  enCaseConverterRoute,
  enQrGeneratorReaderRoute,
  enPasswordGeneratorRoute,
  enAspectRatioCalculatorRoute,
  enJsonFormatterValidatorRoute,
  enBase64EncoderDecoderRoute,
  enColorPickerPaletteRoute,
  enVideoTrimmerSplitterRoute,
  enAudioExtractorMuterRoute,
  enVideoGifMemeRoute,
  enVideoCompressorConverterRoute,
  enAiCaptionerSrtRoute,
  enAudioCutterTrimmerRoute,
  enAiVocalInstrumentalRemoverRoute,
  enAudioCompressorRoute,
  enAudioNoiseReducerRoute,
  enRegexTesterRoute,
  enHashGeneratorRoute,
  ...imageToolRoutes,
  localizedToolRoute,
] as const;
