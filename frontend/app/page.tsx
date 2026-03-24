'use client';

import { useState } from 'react';

export default function Home() {
  const [date, setDate] = useState('');
  const [keywords, setKeywords] = useState('');

  const handleClick = () => {
    console.log(date, keywords);
  };

  return (
    <main style={{ padding: '20px' }}>
      <h1>DateFlow 💕</h1>

      <input
        type="date"
        onChange={(e) => setDate(e.target.value)}
      />

      <input
        type="text"
        placeholder="카페, 전시"
        onChange={(e) => setKeywords(e.target.value)}
      />

      <button onClick={handleClick}>
        플랜 생성
      </button>
    </main>
  );
}