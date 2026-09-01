import React, { useMemo, useState } from 'react';
import { calculateHeight, calculateWidth, parseRatio, RATIO_PRESETS, simplifyRatio } from './engine';
import type { Locale } from '../../lib/i18n';

const COPY: Record<string, Readonly<{
  tool: string;
  description: string;
  ratio: string;
  presets: string;
  width: string;
  height: string;
  invalid: string;
  calculated: string;
  calculatedWidth: string;
  calculatedHeight: string;
  simplifiedRatio: string;
  aspectPreview: string;
}>> = {
  ar: { tool: 'حاسبة نسبة العرض إلى الارتفاع', description: 'احسب الأبعاد المتناسبة مباشرةً داخل متصفحك.', ratio: 'نسبة العرض إلى الارتفاع', presets: 'نسب جاهزة', width: 'العرض', height: 'الارتفاع', invalid: 'أدخل نسبة صالحة مثل 16:9.', calculated: 'الأبعاد المحسوبة', calculatedWidth: 'العرض المحسوب', calculatedHeight: 'الارتفاع المحسوب', simplifiedRatio: 'النسبة المبسطة', aspectPreview: 'معاينة نسبة العرض إلى الارتفاع' },
  en: { tool: 'Aspect Ratio Calculator', description: 'Calculate proportional dimensions locally in your browser.', ratio: 'Aspect ratio', presets: 'Ratio presets', width: 'Width', height: 'Height', invalid: 'Enter a valid ratio such as 16:9.', calculated: 'Calculated dimensions', calculatedWidth: 'Calculated width', calculatedHeight: 'Calculated height', simplifiedRatio: 'Simplified ratio', aspectPreview: 'Aspect preview' },
  es: { tool: 'Calculadora de relación de aspecto', description: 'Calcula dimensiones proporcionales directamente en tu navegador.', ratio: 'Relación de aspecto', presets: 'Relaciones predefinidas', width: 'Ancho', height: 'Alto', invalid: 'Introduce una relación válida, como 16:9.', calculated: 'Dimensiones calculadas', calculatedWidth: 'Ancho calculado', calculatedHeight: 'Alto calculado', simplifiedRatio: 'Relación simplificada', aspectPreview: 'Vista previa de la relación de aspecto' },
  fr: { tool: 'Calculateur de format d’image', description: 'Calculez des dimensions proportionnelles directement dans votre navigateur.', ratio: 'Format d’image', presets: 'Formats prédéfinis', width: 'Largeur', height: 'Hauteur', invalid: 'Saisissez un format valide, par exemple 16:9.', calculated: 'Dimensions calculées', calculatedWidth: 'Largeur calculée', calculatedHeight: 'Hauteur calculée', simplifiedRatio: 'Format simplifié', aspectPreview: 'Aperçu du format' },
  de: { tool: 'Seitenverhältnis-Rechner', description: 'Berechnen Sie proportionale Abmessungen direkt in Ihrem Browser.', ratio: 'Seitenverhältnis', presets: 'Voreingestellte Verhältnisse', width: 'Breite', height: 'Höhe', invalid: 'Geben Sie ein gültiges Verhältnis wie 16:9 ein.', calculated: 'Berechnete Abmessungen', calculatedWidth: 'Berechnete Breite', calculatedHeight: 'Berechnete Höhe', simplifiedRatio: 'Vereinfachtes Verhältnis', aspectPreview: 'Vorschau des Seitenverhältnisses' },
  hi: { tool: 'आस्पेक्ट रेशियो कैलकुलेटर', description: 'अपने ब्राउज़र में सीधे आनुपातिक आयामों की गणना करें।', ratio: 'आस्पेक्ट रेशियो', presets: 'अनुपात प्रीसेट', width: 'चौड़ाई', height: 'ऊंचाई', invalid: '16:9 जैसे मान्य अनुपात दर्ज करें।', calculated: 'परिकलित आयाम', calculatedWidth: 'परिकलित चौड़ाई', calculatedHeight: 'परिकलित ऊंचाई', simplifiedRatio: 'सरल अनुपात', aspectPreview: 'आस्पेक्ट रेशियो पूर्वावलोकन' },
  id: { tool: 'Kalkulator Rasio Aspek', description: 'Hitung dimensi proporsional langsung di browser Anda.', ratio: 'Rasio aspek', presets: 'Preset rasio', width: 'Lebar', height: 'Tinggi', invalid: 'Masukkan rasio yang valid seperti 16:9.', calculated: 'Dimensi terhitung', calculatedWidth: 'Lebar terhitung', calculatedHeight: 'Tinggi terhitung', simplifiedRatio: 'Rasio sederhana', aspectPreview: 'Pratinjau rasio aspek' },
  it: { tool: 'Calcolatore delle proporzioni', description: 'Calcola le dimensioni proporzionali direttamente nel browser.', ratio: 'Proporzioni', presets: 'Proporzioni preimpostate', width: 'Larghezza', height: 'Altezza', invalid: 'Inserisci una proporzione valida come 16:9.', calculated: 'Dimensioni calcolate', calculatedWidth: 'Larghezza calcolata', calculatedHeight: 'Altezza calcolata', simplifiedRatio: 'Proporzione semplificata', aspectPreview: 'Anteprima proporzioni' },
  ja: { tool: 'アスペクト比計算機', description: 'ブラウザ内で縦横比に合わせたサイズを計算します。', ratio: 'アスペクト比', presets: '比率プリセット', width: '幅', height: '高さ', invalid: '16:9 のような有効な比率を入力してください。', calculated: '計算されたサイズ', calculatedWidth: '計算された幅', calculatedHeight: '計算された高さ', simplifiedRatio: '簡略化した比率', aspectPreview: 'アスペクト比プレビュー' },
  ko: { tool: '화면 비율 계산기', description: '브라우저에서 비율에 맞는 크기를 직접 계산합니다.', ratio: '화면 비율', presets: '비율 프리셋', width: '너비', height: '높이', invalid: '16:9와 같은 올바른 비율을 입력하세요.', calculated: '계산된 크기', calculatedWidth: '계산된 너비', calculatedHeight: '계산된 높이', simplifiedRatio: '간단한 비율', aspectPreview: '화면 비율 미리보기' },
  ms: { tool: 'Kalkulator Nisbah Aspek', description: 'Kira dimensi berkadar terus dalam pelayar anda.', ratio: 'Nisbah aspek', presets: 'Pratetap nisbah', width: 'Lebar', height: 'Tinggi', invalid: 'Masukkan nisbah yang sah seperti 16:9.', calculated: 'Dimensi dikira', calculatedWidth: 'Lebar dikira', calculatedHeight: 'Tinggi dikira', simplifiedRatio: 'Nisbah dipermudah', aspectPreview: 'Pratonton nisbah aspek' },
  nl: { tool: 'Beeldverhoudingscalculator', description: 'Bereken proportionele afmetingen rechtstreeks in je browser.', ratio: 'Beeldverhouding', presets: 'Vooraf ingestelde verhoudingen', width: 'Breedte', height: 'Hoogte', invalid: 'Voer een geldige verhouding in, zoals 16:9.', calculated: 'Berekende afmetingen', calculatedWidth: 'Berekende breedte', calculatedHeight: 'Berekende hoogte', simplifiedRatio: 'Vereenvoudigde verhouding', aspectPreview: 'Voorbeeld van beeldverhouding' },
  pl: { tool: 'Kalkulator proporcji obrazu', description: 'Oblicz proporcjonalne wymiary bezpośrednio w przeglądarce.', ratio: 'Proporcje obrazu', presets: 'Gotowe proporcje', width: 'Szerokość', height: 'Wysokość', invalid: 'Wprowadź prawidłowe proporcje, np. 16:9.', calculated: 'Obliczone wymiary', calculatedWidth: 'Obliczona szerokość', calculatedHeight: 'Obliczona wysokość', simplifiedRatio: 'Uproszczone proporcje', aspectPreview: 'Podgląd proporcji obrazu' },
  pt: { tool: 'Calculadora de proporção', description: 'Calcule dimensões proporcionais diretamente no navegador.', ratio: 'Proporção', presets: 'Proporções predefinidas', width: 'Largura', height: 'Altura', invalid: 'Insira uma proporção válida, como 16:9.', calculated: 'Dimensões calculadas', calculatedWidth: 'Largura calculada', calculatedHeight: 'Altura calculada', simplifiedRatio: 'Proporção simplificada', aspectPreview: 'Pré-visualização da proporção' },
  ru: { tool: 'Калькулятор соотношения сторон', description: 'Рассчитайте пропорциональные размеры прямо в браузере.', ratio: 'Соотношение сторон', presets: 'Готовые соотношения', width: 'Ширина', height: 'Высота', invalid: 'Введите корректное соотношение, например 16:9.', calculated: 'Рассчитанные размеры', calculatedWidth: 'Рассчитанная ширина', calculatedHeight: 'Рассчитанная высота', simplifiedRatio: 'Упрощённое соотношение', aspectPreview: 'Предпросмотр соотношения сторон' },
  sv: { tool: 'Kalkylator för bildförhållande', description: 'Beräkna proportionella mått direkt i webbläsaren.', ratio: 'Bildförhållande', presets: 'Förinställda förhållanden', width: 'Bredd', height: 'Höjd', invalid: 'Ange ett giltigt förhållande som 16:9.', calculated: 'Beräknade mått', calculatedWidth: 'Beräknad bredd', calculatedHeight: 'Beräknad höjd', simplifiedRatio: 'Förenklat förhållande', aspectPreview: 'Förhandsvisning av bildförhållande' },
  th: { tool: 'เครื่องคำนวณอัตราส่วนภาพ', description: 'คำนวณขนาดตามสัดส่วนโดยตรงในเบราว์เซอร์ของคุณ', ratio: 'อัตราส่วนภาพ', presets: 'อัตราส่วนสำเร็จรูป', width: 'ความกว้าง', height: 'ความสูง', invalid: 'ป้อนอัตราส่วนที่ถูกต้อง เช่น 16:9', calculated: 'ขนาดที่คำนวณแล้ว', calculatedWidth: 'ความกว้างที่คำนวณแล้ว', calculatedHeight: 'ความสูงที่คำนวณแล้ว', simplifiedRatio: 'อัตราส่วนแบบย่อ', aspectPreview: 'ตัวอย่างอัตราส่วนภาพ' },
  tr: { tool: 'En Boy Oranı Hesaplayıcı', description: 'Orantılı boyutları doğrudan tarayıcınızda hesaplayın.', ratio: 'En boy oranı', presets: 'Oran hazır ayarları', width: 'Genişlik', height: 'Yükseklik', invalid: '16:9 gibi geçerli bir oran girin.', calculated: 'Hesaplanan boyutlar', calculatedWidth: 'Hesaplanan genişlik', calculatedHeight: 'Hesaplanan yükseklik', simplifiedRatio: 'Basitleştirilmiş oran', aspectPreview: 'En boy oranı önizlemesi' },
  uk: { tool: 'Калькулятор співвідношення сторін', description: 'Розраховуйте пропорційні розміри безпосередньо у браузері.', ratio: 'Співвідношення сторін', presets: 'Готові співвідношення', width: 'Ширина', height: 'Висота', invalid: 'Введіть коректне співвідношення, наприклад 16:9.', calculated: 'Розраховані розміри', calculatedWidth: 'Розрахована ширина', calculatedHeight: 'Розрахована висота', simplifiedRatio: 'Спрощене співвідношення', aspectPreview: 'Попередній перегляд співвідношення сторін' },
  vi: { tool: 'Máy tính tỷ lệ khung hình', description: 'Tính kích thước theo tỷ lệ trực tiếp trong trình duyệt của bạn.', ratio: 'Tỷ lệ khung hình', presets: 'Tỷ lệ có sẵn', width: 'Chiều rộng', height: 'Chiều cao', invalid: 'Nhập tỷ lệ hợp lệ như 16:9.', calculated: 'Kích thước đã tính', calculatedWidth: 'Chiều rộng đã tính', calculatedHeight: 'Chiều cao đã tính', simplifiedRatio: 'Tỷ lệ đã rút gọn', aspectPreview: 'Xem trước tỷ lệ khung hình' },
};

export function AspectRatioCalculatorTool({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = COPY[locale] ?? COPY.en;
  const [ratioText, setRatioText] = useState('16:9');
  const [width, setWidth] = useState('1920');
  const [height, setHeight] = useState('');
  const [lastEdited, setLastEdited] = useState<'width' | 'height'>('width');

  const ratio = useMemo(() => parseRatio(ratioText), [ratioText]);
  const invalid = !ratio;

  const computed = useMemo(() => {
    if (!ratio) return { width: null, height: null };
    if (lastEdited === 'width') {
      const numericWidth = Number(width);
      return { width: numericWidth > 0 ? numericWidth : null, height: calculateHeight(numericWidth, ratio) };
    }
    const numericHeight = Number(height);
    return { width: calculateWidth(numericHeight, ratio), height: numericHeight > 0 ? numericHeight : null };
  }, [height, lastEdited, ratio, width]);

  const simplified = ratio ? simplifyRatio(ratio.width, ratio.height) : null;
  const previewWidth = computed.width ?? 1;
  const previewHeight = computed.height ?? 1;
  const previewRatio = Math.min(320 / previewWidth, 220 / previewHeight);

  const applyPreset = (preset: (typeof RATIO_PRESETS)[number]) => {
    setRatioText(preset.label);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6" aria-label={copy.tool}>
      <header>
        <h1 className="text-3xl font-semibold">{copy.tool}</h1>
        <p className="mt-2 text-sm opacity-80">{copy.description}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span>{copy.ratio}</span>
          <input aria-label={copy.ratio} value={ratioText} onChange={(event) => setRatioText(event.target.value)} className="rounded border p-2" inputMode="decimal" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label={copy.presets}>
          {RATIO_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="rounded border px-3 py-2">
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span>{copy.width}</span>
          <input aria-label={copy.width} value={lastEdited === 'width' ? width : String(computed.width ?? '')} onChange={(event) => { setWidth(event.target.value); setLastEdited('width'); }} className="rounded border p-2" inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-2">
          <span>{copy.height}</span>
          <input aria-label={copy.height} value={lastEdited === 'height' ? height : String(computed.height ?? '')} onChange={(event) => { setHeight(event.target.value); setLastEdited('height'); }} className="rounded border p-2" inputMode="decimal" />
        </label>
      </section>

      {invalid ? <p role="alert" className="text-sm">{copy.invalid}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-medium">{copy.calculated}</h2>
          <p aria-label={copy.calculatedWidth}>{copy.width}: {computed.width == null ? '—' : Math.round(computed.width)}</p>
          <p aria-label={copy.calculatedHeight}>{copy.height}: {computed.height == null ? '—' : Math.round(computed.height)}</p>
          <p aria-label={copy.simplifiedRatio}>{copy.ratio}: {simplified ? `${simplified.width}:${simplified.height}` : '—'}</p>
        </div>
        <div className="flex min-h-56 items-center justify-center rounded border p-4" aria-label={copy.aspectPreview}>
          <div className="rounded border bg-black/10" style={{ width: Math.max(20, previewWidth * previewRatio), height: Math.max(20, previewHeight * previewRatio) }} />
        </div>
      </section>
    </main>
  );
}
