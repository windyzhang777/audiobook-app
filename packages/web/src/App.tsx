import './i18n';
import '@/App.css';
import { BookList } from '@/pages/BookList';
import { BookReader } from '@/pages/BookReader';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BookList />} />
          <Route path="/book/:id" element={<BookReader />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
