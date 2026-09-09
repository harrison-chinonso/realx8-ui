import { useEffect, useRef, useState } from 'react';

const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&auto=format&q=80',
    category: 'Residential',
    title: 'Luxury Living',
    subtitle: 'Premium homes for discerning buyers',
  },
  {
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&auto=format&q=80',
    category: 'Commercial',
    title: 'Prime Office Spaces',
    subtitle: 'Strategic locations for growing businesses',
  },
  {
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1400&auto=format&q=80',
    category: 'Residential',
    title: 'Modern Villas',
    subtitle: 'Exclusive properties with exceptional design',
  },
  {
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1400&auto=format&q=80',
    category: 'Commercial',
    title: 'Urban Developments',
    subtitle: 'High-value investment opportunities',
  },
];

export default function PropertyCarousel({ className = '' }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  const advance = () => setActive((a) => (a + 1) % SLIDES.length);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, []);

  const goTo = (idx) => {
    setActive(idx);
    startTimer();
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {SLIDES.map((slide, idx) => (
        <div
          key={idx}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: idx === active ? 1 : 0, zIndex: idx === active ? 1 : 0 }}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
            loading={idx === 0 ? 'eager' : 'lazy'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/30" />
        </div>
      ))}

      {/* Text overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
        <span className="inline-block mb-3 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-white/60 border border-white/20 rounded-sm">
          {SLIDES[active].category}
        </span>
        <h2 className="text-3xl font-bold text-white leading-tight">{SLIDES[active].title}</h2>
        <p className="mt-1.5 text-sm text-white/55">{SLIDES[active].subtitle}</p>

        <div className="flex items-center gap-2 mt-6">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="rounded-full transition-all duration-400 cursor-pointer"
              style={{
                width: idx === active ? '2rem' : '0.35rem',
                height: '0.2rem',
                backgroundColor: idx === active ? '#fff' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
