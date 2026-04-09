import '@/App.css';
import { ErrorBoundary } from '@/common/ErrorBoundary';
import { ThemeProvider } from '@/components/theme-provider';
import '@/i18n';
import { BookList } from '@/pages/BookList';
import { BookReader } from '@/pages/BookReader';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<BookList />} />
            <Route path="/book/:id" element={<BookReader />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
