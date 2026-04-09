interface BookItemPlaceholderProps {
  title: string;
  author: string | undefined;
}

export const BookItemPlaceholder = ({ title, author }: BookItemPlaceholderProps) => (
  <div className="book-cover relative select-none w-full h-full font-[Open_Sans] bg-linear-to-b from-sky-950 to-gray-900 flex flex-col items-center pl-7 pr-5 py-8 text-center shadow-inner overflow-hidden">
    <span className="text-xs uppercase font-semibold text-amber-100/90 leading-relaxed tracking-widest line-clamp-4 border-t border-b py-1 w-full border-amber-400/40">
      {title} {author ? `(${author})` : ''}
    </span>

    <BindingLine />
  </div>
);

export const BindingLine = () => (
  <div
    className="absolute left-0 top-0 bottom-0 w-4 z-10 pointer-events-none"
    style={{
      background: `linear-gradient(90deg, 
        rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 2px,               /* Spine Edge (w-0.5) */
        rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 3px,   /* Hinge Groove (left-0.5 w-px) */
        rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.1) 5px,   /* Hinge Glow (left-0.75 w-0.5) */
        transparent 5px,
        rgba(0,0,0,0.05) 6px, rgba(0,0,0,0.02) 8px,             /* Spine Texture (left-1.5 w-0.5) */
        transparent 9px,
        rgba(255,255,255,0.4) 9px, transparent 11px             /* Surface Glow (left-2.5 w-0.75) */
      )`,
    }}
  />
);
