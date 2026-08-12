import { useState, useEffect, createContext, useContext } from 'react';

const translations = {
  en: {
    app_title: "Sewa",
    app_subtitle: "Civic Issue Reporting & Escalation Platform",
    tagline: "Empowering citizens, bypassing bureaucracy.",
    developed_by: "Developed by Manish",
    
    // Navigation
    nav_home: "Map View",
    nav_report: "Report Issue",
    nav_my_reports: "My Timeline",
    nav_transparency: "Transparency",
    nav_authority: "Authority Portal",
    
    // Buttons
    btn_submit: "Submit Grievance",
    btn_submitting: "Submitting...",
    btn_cancel: "Cancel",
    btn_login: "Login",
    btn_get_otp: "Get OTP",
    btn_verify: "Verify & Enter",
    btn_logout: "Logout",
    btn_resolve: "Mark Resolved",
    btn_acknowledge: "Acknowledge",
    btn_blur_mode: "Toggle Privacy Blur",
    
    // Auth Screen
    auth_title: "Citizen Login",
    auth_desc: "Enter your mobile number to receive an instant verification code.",
    phone_label: "Phone Number",
    otp_label: "6-Digit Verification Code",
    name_label: "Your Full Name (Optional)",
    auth_bypass_tip: "For local testing, use code: 123456",
    
    // Report Flow
    report_title: "Report a Civic Grievance",
    report_desc: "Tap the camera to capture video, photo, or audio of the incident.",
    gps_tagging: "GPS Geo-Tagging Status",
    gps_ready: "GPS Locked",
    gps_fetching: "Locating you...",
    caption_placeholder: "Add any optional details or landmark descriptions here...",
    media_captured: "Media captured successfully",
    compressing: "Compressing media client-side for low networks...",
    privacy_blur_desc: "Tap on the image where bystander faces are visible to apply privacy blur.",
    
    // My Reports
    my_reports_title: "My Civic Filings",
    no_reports: "You haven't filed any reports yet.",
    status_submitted: "Submitted",
    status_acknowledged: "Acknowledged",
    status_escalated: "Escalated",
    status_resolved: "Resolved",
    timeline_view: "Audit Timeline",
    
    // Transparency
    transparency_title: "Public Ward Analytics",
    trans_desc: "Real-time statistics of local grievance density and administrative resolution rates.",
    stat_total: "Total Filings",
    stat_resolved: "Resolved Cases",
    stat_active: "Active Grievances",
    stat_rate: "Resolution Rate",
    category_breakdown: "Incident Density by Category",
    pothole: "Potholes & Road Damage",
    garbage: "Garbage & Sanitation",
    animal: "Injured / Stray Animals",
    emergency: "Fire & Building Emergency",
    other: "Other Complaints",
    
    // Authority
    authority_title: "Authority Response Portal",
    auth_welcome: "Active Cases Dashboard",
    report_count: "Citizens Impacted",
    unresolved: "Unresolved",
    escalated_level: "Escalation Level",
    evidence_packet: "Legal Evidence Packet",
    view_packet: "Download Evidence JSON",
    no_cases: "No active cases assigned to your geofence jurisdiction."
  },
  hi: {
    app_title: "सेवा",
    app_subtitle: "नागरिक शिकायत और स्वतः निवारण मंच",
    tagline: "नागरिकों को सशक्त बनाना, नौकरशाही को बायपास करना।",
    developed_by: "मनीष द्वारा विकसित",
    
    // Navigation
    nav_home: "मानचित्र",
    nav_report: "शिकायत दर्ज करें",
    nav_my_reports: "मेरी टाइमलाइन",
    nav_transparency: "सार्वजनिक रिकॉर्ड",
    nav_authority: "अधिकारी पोर्टल",
    
    // Buttons
    btn_submit: "शिकायत जमा करें",
    btn_submitting: "जमा हो रहा है...",
    btn_cancel: "रद्द करें",
    btn_login: "लॉगिन करें",
    btn_get_otp: "ओटीपी प्राप्त करें",
    btn_verify: "सत्यापित करें और प्रवेश करें",
    btn_logout: "लॉगआउट",
    btn_resolve: "निवारण चिह्नित करें",
    btn_acknowledge: "स्वीकार करें",
    btn_blur_mode: "गोपनीयता धुंधला (Blur) टॉगल करें",
    
    // Auth Screen
    auth_title: "नागरिक लॉगिन",
    auth_desc: "त्वरित सत्यापन कोड प्राप्त करने के लिए अपना मोबाइल नंबर दर्ज करें।",
    phone_label: "फ़ोन नंबर",
    otp_label: "6-अंकों का सत्यापन कोड",
    name_label: "आपका पूरा नाम (वैकल्पिक)",
    auth_bypass_tip: "स्थानीय परीक्षण के लिए कोड: 123456 का उपयोग करें",
    
    // Report Flow
    report_title: "नागरिक शिकायत की रिपोर्ट करें",
    report_desc: "घटना का वीडियो, फोटो या ऑडियो रिकॉर्ड करने के लिए कैमरा आइकन पर टैप करें।",
    gps_tagging: "जीपीएस भू-टैगिंग स्थिति",
    gps_ready: "जीपीएस लॉक",
    gps_fetching: "आपकी स्थिति खोजी जा रही है...",
    caption_placeholder: "यहां कोई भी विवरण या लैंडमार्क जानकारी दर्ज करें...",
    media_captured: "मीडिया सफलतापूर्वक रिकॉर्ड किया गया",
    compressing: "धीमे नेटवर्क के लिए मीडिया को कंप्रेस किया जा रहा है...",
    privacy_blur_desc: "गोपनीयता धुंधलापन लागू करने के लिए छवि में वहां टैप करें जहां चेहरे दिख रहे हों।",
    
    // My Reports
    my_reports_title: "मेरी शिकायतें",
    no_reports: "आपने अभी तक कोई शिकायत दर्ज नहीं की है।",
    status_submitted: "प्रस्तुत किया गया",
    status_acknowledged: "स्वीकृत",
    status_escalated: "उच्च मंत्रालय को प्रेषित",
    status_resolved: "समाधान हो गया",
    timeline_view: "ऑडिट टाइमलाइन",
    
    // Transparency
    transparency_title: "सार्वजनिक वार्ड विश्लेषण",
    trans_desc: "स्थानीय शिकायतों के घनत्व और प्रशासनिक निवारण दरों के वास्तविक समय के आंकड़े।",
    stat_total: "कुल शिकायतें",
    stat_resolved: "सुलझाए गए मामले",
    stat_active: "सक्रिय शिकायतें",
    stat_rate: "निवारण दर",
    category_breakdown: "श्रेणी अनुसार शिकायतों का घनत्व",
    pothole: "सड़क के गड्ढे और क्षति",
    garbage: "कचरा और स्वच्छता",
    animal: "घायल / आवारा पशु",
    emergency: "आग और आपातकालीन संकट",
    other: "अन्य शिकायतें",
    
    // Authority
    authority_title: "अधिकारी प्रतिक्रिया पोर्टल",
    auth_welcome: "सक्रिय मामले डैशबोर्ड",
    report_count: "प्रभावित नागरिक",
    unresolved: "सुलझाया नहीं गया",
    escalated_level: "प्रेषण स्तर",
    evidence_packet: "कानूनी साक्ष्य पैकेट",
    view_packet: "साक्ष्य JSON डाउनलोड करें",
    no_cases: "आपके क्षेत्राधिकार में कोई सक्रिय मामला नहीं है।"
  }
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('sewa_lang') || 'en';
  });

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('sewa_lang', newLang);
  };

  const t = (key) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
