# Multi-language Support Technical Specification

## Overview

This document outlines the technical approach to implementing multi-language support in the WakeBook application. The feature will allow users to interact with the system in their preferred language, enhancing accessibility and user experience.

## Technical Requirements

### Supported Languages

Initial implementation will support the following languages:
- English (default)
- Latvian
- Russian

Additional languages can be added in the future as needed.

### Technology Stack

- **i18n Framework**: `i18next` with React integration
- **Language Detection**: Browser language detection with manual override
- **Translation Management**: JSON-based translation files
- **Date/Time Formatting**: Locale-aware formatting using `date-fns` with locale extensions

## Data Model Changes

### User Preferences Table

Add language preference to user settings:

```typescript
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  language: text('language').default('en').notNull(),
  // ... other preferences
});
```

### System Configuration

Add supported languages to system configuration:

```typescript
export const systemConfig = pgTable('system_config', {
  // ... existing fields
  supportedLanguages: text('supported_languages').array().default(['en', 'lv', 'ru']),
  defaultLanguage: text('default_language').default('en').notNull(),
});
```

## Implementation Details

### 1. Translation File Structure

```
/shared/translations/
  ├── en/
  │   ├── common.json
  │   ├── booking.json
  │   ├── admin.json
  │   └── errors.json
  ├── lv/
  │   ├── common.json
  │   ├── booking.json
  │   ├── admin.json
  │   └── errors.json
  └── ru/
      ├── common.json
      ├── booking.json
      ├── admin.json
      └── errors.json
```

### 2. i18next Configuration

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files
import enCommon from '@shared/translations/en/common.json';
import enBooking from '@shared/translations/en/booking.json';
// ... other imports

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        booking: enBooking,
        // ... other namespaces
      },
      // ... other languages
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'querystring'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'wakebookLanguage'
    }
  });

export default i18n;
```

### 3. Language Context Provider

```typescript
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { enUS, lv, ru } from 'date-fns/locale';

const locales = {
  en: enUS,
  lv: lv,
  ru: ru
};

const LanguageContext = createContext<{
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  dateLocale: Locale;
}>({
  currentLanguage: 'en',
  setLanguage: () => {},
  dateLocale: enUS
});

export const LanguageProvider: React.FC = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [dateLocale, setDateLocale] = useState(locales.en);

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
    setDateLocale(locales[lang] || locales.en);
    localStorage.setItem('wakebookLanguage', lang);
  };

  useEffect(() => {
    const savedLang = localStorage.getItem('wakebookLanguage');
    if (savedLang && Object.keys(locales).includes(savedLang)) {
      setLanguage(savedLang);
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
```

### 4. Language Selector Component

```typescript
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/language-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LanguageSelector() {
  const { t } = useTranslation('common');
  const { currentLanguage, setLanguage } = useLanguage();

  return (
    <Select value={currentLanguage} onValueChange={setLanguage}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t('selectLanguage')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="lv">Latviešu</SelectItem>
        <SelectItem value="ru">Русский</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

### 5. Date Formatting with Localization

```typescript
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';

export function LocalizedDateDisplay({ date }) {
  const { dateLocale } = useLanguage();
  
  return (
    <span>{format(new Date(date), 'PPP', { locale: dateLocale })}</span>
  );
}
```

### 6. Translation Usage in Components

```typescript
import { useTranslation } from 'react-i18next';

function BookingForm() {
  const { t } = useTranslation(['common', 'booking']);
  
  return (
    <div>
      <h2>{t('booking:formTitle')}</h2>
      <p>{t('booking:instructions')}</p>
      <button>{t('common:submit')}</button>
    </div>
  );
}
```

### 7. Server-side Email Localization

```typescript
async function sendBookingConfirmation(booking, userLanguage) {
  // Load translations for the user's language
  const translations = await loadTranslations(userLanguage || 'en', 'email');
  
  // Use the translations to format the email
  const subject = translations.bookingConfirmationSubject;
  const body = formatEmailTemplate(booking, translations);
  
  // Send the localized email
  return sendEmail(booking.email, subject, body);
}
```

## Implementation Plan

1. **Week 1**: Set up i18n infrastructure and create translation files for core functionality
2. **Week 2**: Implement language switching functionality and context provider
3. **Week 3**: Update all user-facing components to use translation system
4. **Week 4**: Implement server-side internationalization for emails and notifications
5. **Week 5**: QA testing and refinement

## Testing Strategy

1. **Unit Tests**: Verify translation function behavior
2. **Integration Tests**: Ensure correct language switching and persistence
3. **UI Tests**: Verify proper display of translated content in all components
4. **Accessibility Tests**: Ensure RTL support works correctly where needed
5. **Localization Testing**: Validate date/time/number formats in each language

## Deployment Considerations

- Translation files should be loaded dynamically to minimize initial bundle size
- Consider using a translation management system for future scale
- Add language parameter support in shareable URLs