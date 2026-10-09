import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import Home from './pages/Home.jsx';
import Request from './pages/Request.jsx';
import NotFound from './pages/NotFound.jsx';

/** Scroll to the top on a page change, or to the #section a link names. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  // The chat can be opened from anywhere on the page ("Ask a question").
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = () => setChatOpen(true);

  return (
    <>
      <ScrollManager />
      <Header />
      <main id="content">
        <Routes>
          <Route path="/" element={<Home onAsk={openChat} />} />
          <Route path="/request" element={<Request onAsk={openChat} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ChatWidget open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
