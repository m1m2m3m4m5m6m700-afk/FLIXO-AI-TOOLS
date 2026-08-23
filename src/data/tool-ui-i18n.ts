import type { Locale } from '@/lib/i18n';

export type ToolUiCopy = Readonly<{
  notFound: string;
  loading: string;
  language: string;
  about: string;
  howTo: string;
  features: string;
}>;

export const TOOL_UI_I18N: Record<Locale, ToolUiCopy> = {
  en: { notFound: 'Tool not found', loading: 'Loading FLIXO tool…', language: 'Language', about: 'About this tool', howTo: 'How to use', features: 'Key features' },
  ar: { notFound: 'الأداة غير موجودة', loading: 'جارٍ تحميل أداة FLIXO…', language: 'اللغة', about: 'حول هذه الأداة', howTo: 'طريقة الاستخدام', features: 'أهم المزايا' },
  es: { notFound: 'Herramienta no encontrada', loading: 'Cargando herramienta de FLIXO…', language: 'Idioma', about: 'Sobre esta herramienta', howTo: 'Cómo usarla', features: 'Funciones principales' },
  fr: { notFound: 'Outil introuvable', loading: 'Chargement de l’outil FLIXO…', language: 'Langue', about: 'À propos de cet outil', howTo: 'Comment l’utiliser', features: 'Fonctions principales' },
  de: { notFound: 'Tool nicht gefunden', loading: 'FLIXO-Tool wird geladen…', language: 'Sprache', about: 'Über dieses Tool', howTo: 'So funktioniert es', features: 'Wichtige Funktionen' },
  ru: { notFound: 'Инструмент не найден', loading: 'Загрузка инструмента FLIXO…', language: 'Язык', about: 'Об инструменте', howTo: 'Как использовать', features: 'Основные возможности' },
  zh: { notFound: '未找到工具', loading: '正在加载 FLIXO 工具…', language: '语言', about: '关于此工具', howTo: '使用方法', features: '主要功能' },
  hi: { notFound: 'टूल नहीं मिला', loading: 'FLIXO टूल लोड हो रहा है…', language: 'भाषा', about: 'इस टूल के बारे में', howTo: 'कैसे उपयोग करें', features: 'मुख्य सुविधाएँ' },
  id: { notFound: 'Alat tidak ditemukan', loading: 'Memuat alat FLIXO…', language: 'Bahasa', about: 'Tentang alat ini', howTo: 'Cara menggunakan', features: 'Fitur utama' },
  ur: { notFound: 'ٹول نہیں ملا', loading: 'FLIXO ٹول لوڈ ہو رہا ہے…', language: 'زبان', about: 'اس ٹول کے بارے میں', howTo: 'استعمال کا طریقہ', features: 'اہم خصوصیات' },
  ja: { notFound: 'ツールが見つかりません', loading: 'FLIXO ツールを読み込んでいます…', language: '言語', about: 'このツールについて', howTo: '使い方', features: '主な機能' },
  pt: { notFound: 'Ferramenta não encontrada', loading: 'Carregando a ferramenta FLIXO…', language: 'Idioma', about: 'Sobre esta ferramenta', howTo: 'Como usar', features: 'Principais recursos' },
  it: { notFound: 'Strumento non trovato', loading: 'Caricamento dello strumento FLIXO…', language: 'Lingua', about: 'Informazioni sullo strumento', howTo: 'Come usarlo', features: 'Funzioni principali' },
  ko: { notFound: '도구를 찾을 수 없습니다', loading: 'FLIXO 도구를 불러오는 중…', language: '언어', about: '이 도구 정보', howTo: '사용 방법', features: '주요 기능' },
  nl: { notFound: 'Tool niet gevonden', loading: 'FLIXO-tool wordt geladen…', language: 'Taal', about: 'Over deze tool', howTo: 'Zo gebruik je het', features: 'Belangrijkste functies' },
  pl: { notFound: 'Nie znaleziono narzędzia', loading: 'Ładowanie narzędzia FLIXO…', language: 'Język', about: 'O tym narzędziu', howTo: 'Jak używać', features: 'Najważniejsze funkcje' },
  tr: { notFound: 'Araç bulunamadı', loading: 'FLIXO aracı yükleniyor…', language: 'Dil', about: 'Bu araç hakkında', howTo: 'Nasıl kullanılır', features: 'Temel özellikler' },
  vi: { notFound: 'Không tìm thấy công cụ', loading: 'Đang tải công cụ FLIXO…', language: 'Ngôn ngữ', about: 'Về công cụ này', howTo: 'Cách sử dụng', features: 'Tính năng chính' },
  th: { notFound: 'ไม่พบเครื่องมือ', loading: 'กำลังโหลดเครื่องมือ FLIXO…', language: 'ภาษา', about: 'เกี่ยวกับเครื่องมือนี้', howTo: 'วิธีใช้งาน', features: 'คุณสมบัติหลัก' },
  sv: { notFound: 'Verktyget hittades inte', loading: 'Laddar FLIXO-verktyget…', language: 'Språk', about: 'Om detta verktyg', howTo: 'Så använder du det', features: 'Viktiga funktioner' },
};
