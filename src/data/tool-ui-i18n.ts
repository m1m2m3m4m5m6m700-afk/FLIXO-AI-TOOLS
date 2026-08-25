import type { Locale } from '@/lib/i18n';

export type ToolUiCopy = Readonly<{
  notFound: string;
  loading: string;
  language: string;
  about: string;
  howTo: string;
  features: string;
  navigation: string;
  home: string;
  ready: string;
  workspace: string;
  favorite: string;
  english: string;
  arabic: string;
}>;

export const TOOL_UI_I18N: Record<Locale, ToolUiCopy> = {
  en: { notFound: 'Tool not found', loading: 'Loading FLIXO tool…', language: 'Language', about: 'About this tool', howTo: 'How to use', features: 'Key features', navigation: 'FLIXO tool navigation', home: 'Home', ready: 'Ready', workspace: 'Tool workspace', favorite: 'Favorite', english: 'English', arabic: 'العربية' },
  ar: { notFound: 'الأداة غير موجودة', loading: 'جارٍ تحميل أداة FLIXO…', language: 'اللغة', about: 'حول هذه الأداة', howTo: 'طريقة الاستخدام', features: 'أهم المزايا', navigation: 'تنقل أدوات FLIXO', home: 'الرئيسية', ready: 'جاهزة', workspace: 'مساحة عمل الأداة', favorite: 'المفضلة', english: 'English', arabic: 'العربية' },
  es: { notFound: 'Herramienta no encontrada', loading: 'Cargando herramienta de FLIXO…', language: 'Idioma', about: 'Sobre esta herramienta', howTo: 'Cómo usarla', features: 'Funciones principales', navigation: 'Navegación de herramientas de FLIXO', home: 'Inicio', ready: 'Lista', workspace: 'Espacio de trabajo', favorite: 'Favorito', english: 'Inglés', arabic: 'Árabe' },
  fr: { notFound: 'Outil introuvable', loading: 'Chargement de l’outil FLIXO…', language: 'Langue', about: 'À propos de cet outil', howTo: 'Comment l’utiliser', features: 'Fonctions principales', navigation: 'Navigation des outils FLIXO', home: 'Accueil', ready: 'Prêt', workspace: 'Espace de travail', favorite: 'Favori', english: 'Anglais', arabic: 'Arabe' },
  de: { notFound: 'Tool nicht gefunden', loading: 'FLIXO-Tool wird geladen…', language: 'Sprache', about: 'Über dieses Tool', howTo: 'So funktioniert es', features: 'Wichtige Funktionen', navigation: 'FLIXO-Tool-Navigation', home: 'Startseite', ready: 'Bereit', workspace: 'Arbeitsbereich', favorite: 'Favorit', english: 'Englisch', arabic: 'Arabisch' },
  ru: { notFound: 'Инструмент не найден', loading: 'Загрузка инструмента FLIXO…', language: 'Язык', about: 'Об инструменте', howTo: 'Как использовать', features: 'Основные возможности', navigation: 'Навигация по инструментам FLIXO', home: 'Главная', ready: 'Готово', workspace: 'Рабочая область', favorite: 'Избранное', english: 'Английский', arabic: 'Арабский' },
  zh: { notFound: '未找到工具', loading: '正在加载 FLIXO 工具…', language: '语言', about: '关于此工具', howTo: '使用方法', features: '主要功能', navigation: 'FLIXO 工具导航', home: '首页', ready: '就绪', workspace: '工具工作区', favorite: '收藏', english: '英语', arabic: '阿拉伯语' },
  hi: { notFound: 'टूल नहीं मिला', loading: 'FLIXO टूल लोड हो रहा है…', language: 'भाषा', about: 'इस टूल के बारे में', howTo: 'कैसे उपयोग करें', features: 'मुख्य सुविधाएँ', navigation: 'FLIXO टूल नेविगेशन', home: 'होम', ready: 'तैयार', workspace: 'टूल कार्यक्षेत्र', favorite: 'पसंदीदा', english: 'अंग्रेज़ी', arabic: 'अरबी' },
  id: { notFound: 'Alat tidak ditemukan', loading: 'Memuat alat FLIXO…', language: 'Bahasa', about: 'Tentang alat ini', howTo: 'Cara menggunakan', features: 'Fitur utama', navigation: 'Navigasi alat FLIXO', home: 'Beranda', ready: 'Siap', workspace: 'Ruang kerja alat', favorite: 'Favorit', english: 'Inggris', arabic: 'Arab' },
  ur: { notFound: 'ٹول نہیں ملا', loading: 'FLIXO ٹول لوڈ ہو رہا ہے…', language: 'زبان', about: 'اس ٹول کے بارے میں', howTo: 'استعمال کا طریقہ', features: 'اہم خصوصیات', navigation: 'FLIXO ٹول نیویگیشن', home: 'ہوم', ready: 'تیار', workspace: 'ٹول ورک اسپیس', favorite: 'پسندیدہ', english: 'English', arabic: 'العربية' },
  ja: { notFound: 'ツールが見つかりません', loading: 'FLIXO ツールを読み込んでいます…', language: '言語', about: 'このツールについて', howTo: '使い方', features: '主な機能', navigation: 'FLIXO ツールナビゲーション', home: 'ホーム', ready: '準備完了', workspace: 'ツールワークスペース', favorite: 'お気に入り', english: '英語', arabic: 'アラビア語' },
  pt: { notFound: 'Ferramenta não encontrada', loading: 'Carregando a ferramenta FLIXO…', language: 'Idioma', about: 'Sobre esta ferramenta', howTo: 'Como usar', features: 'Principais recursos', navigation: 'Navegação das ferramentas FLIXO', home: 'Início', ready: 'Pronto', workspace: 'Área de trabalho', favorite: 'Favorito', english: 'Inglês', arabic: 'Árabe' },
  it: { notFound: 'Strumento non trovato', loading: 'Caricamento dello strumento FLIXO…', language: 'Lingua', about: 'Informazioni sullo strumento', howTo: 'Come usarlo', features: 'Funzioni principali', navigation: 'Navigazione strumenti FLIXO', home: 'Home', ready: 'Pronto', workspace: 'Area di lavoro', favorite: 'Preferito', english: 'Inglese', arabic: 'Arabo' },
  ko: { notFound: '도구를 찾을 수 없습니다', loading: 'FLIXO 도구를 불러오는 중…', language: '언어', about: '이 도구 정보', howTo: '사용 방법', features: '주요 기능', navigation: 'FLIXO 도구 탐색', home: '홈', ready: '준비됨', workspace: '도구 작업 공간', favorite: '즐겨찾기', english: '영어', arabic: '아랍어' },
  nl: { notFound: 'Tool niet gevonden', loading: 'FLIXO-tool wordt geladen…', language: 'Taal', about: 'Over deze tool', howTo: 'Zo gebruik je het', features: 'Belangrijkste functies', navigation: 'FLIXO-toolnavigatie', home: 'Home', ready: 'Gereed', workspace: 'Werkruimte', favorite: 'Favoriet', english: 'Engels', arabic: 'Arabisch' },
  pl: { notFound: 'Nie znaleziono narzędzia', loading: 'Ładowanie narzędzia FLIXO…', language: 'Język', about: 'O tym narzędziu', howTo: 'Jak używać', features: 'Najważniejsze funkcje', navigation: 'Nawigacja narzędzi FLIXO', home: 'Start', ready: 'Gotowe', workspace: 'Obszar roboczy narzędzia', favorite: 'Ulubione', english: 'Angielski', arabic: 'Arabski' },
  tr: { notFound: 'Araç bulunamadı', loading: 'FLIXO aracı yükleniyor…', language: 'Dil', about: 'Bu araç hakkında', howTo: 'Nasıl kullanılır', features: 'Temel özellikler', navigation: 'FLIXO araç gezintisi', home: 'Ana sayfa', ready: 'Hazır', workspace: 'Araç çalışma alanı', favorite: 'Favori', english: 'İngilizce', arabic: 'Arapça' },
  vi: { notFound: 'Không tìm thấy công cụ', loading: 'Đang tải công cụ FLIXO…', language: 'Ngôn ngữ', about: 'Về công cụ này', howTo: 'Cách sử dụng', features: 'Tính năng chính', navigation: 'Điều hướng công cụ FLIXO', home: 'Trang chủ', ready: 'Sẵn sàng', workspace: 'Không gian làm việc', favorite: 'Yêu thích', english: 'Tiếng Anh', arabic: 'Tiếng Ả Rập' },
  th: { notFound: 'ไม่พบเครื่องมือ', loading: 'กำลังโหลดเครื่องมือ FLIXO…', language: 'ภาษา', about: 'เกี่ยวกับเครื่องมือนี้', howTo: 'วิธีใช้งาน', features: 'คุณสมบัติหลัก', navigation: 'การนำทางเครื่องมือ FLIXO', home: 'หน้าแรก', ready: 'พร้อม', workspace: 'พื้นที่ทำงานเครื่องมือ', favorite: 'รายการโปรด', english: 'อังกฤษ', arabic: 'อาหรับ' },
  sv: { notFound: 'Verktyget hittades inte', loading: 'Laddar FLIXO-verktyget…', language: 'Språk', about: 'Om detta verktyg', howTo: 'Så använder du det', features: 'Viktiga funktioner', navigation: 'FLIXO-verktygsnavigering', home: 'Hem', ready: 'Klar', workspace: 'Arbetsyta för verktyget', favorite: 'Favorit', english: 'Engelska', arabic: 'Arabiska' },
};
