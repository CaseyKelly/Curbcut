import { useState } from 'react';

const questions = [
  {
    id: 'delivery',
    question: 'How are plants delivered?',
    answer: 'In a recyclable box with the pot wrapped in paper.',
  },
  {
    id: 'returns',
    question: 'What if my plant arrives damaged?',
    answer: 'Send us a photo within 7 days and we will replace it.',
  },
  {
    id: 'care',
    question: 'Do you include care instructions?',
    answer: 'Every plant comes with a care card.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<string | null>('delivery');

  return (
    <section id="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Questions</h2>
      {questions.map((q) => {
        const isOpen = open === q.id;
        return (
          <div className="faq-item" key={q.id}>
            <h3>
              <button
                type="button"
                className="faq-question"
                aria-expanded={isOpen}
                aria-controls={`faq-${q.id}-panel`}
                onClick={() => setOpen(isOpen ? null : q.id)}
              >
                {q.question}
              </button>
            </h3>
            <div id={`faq-panel-${q.id}`} className="faq-panel" aria-hidden={!isOpen}>
              <p>
                {q.answer} <a href="/care-guide">Read the care guide</a>
              </p>
            </div>
          </div>
        );
      })}
      <details className="faq-more">
        <summary>Still stuck?</summary>
        <p>
          Email <a href="mailto:hello@fernleaf.example">hello@fernleaf.example</a> and a real person
          will reply.
        </p>
      </details>
    </section>
  );
}
