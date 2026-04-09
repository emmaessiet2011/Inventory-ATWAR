import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

type ResponsiveProps = React.ComponentProps<typeof ResponsiveContainer>;

interface SafeResponsiveContainerProps extends Omit<ResponsiveProps, 'children'> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({
  children,
  className = 'w-full h-full',
  style,
  fallback = null,
  width = '100%',
  height = '100%',
  ...rest
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const hasRealSize = rect.width > 1 && rect.height > 1;
      setReady(prev => (prev === hasRealSize ? prev : hasRealSize));
    };

    measure();

    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={hostRef} className={className} style={style}>
      {ready ? (
        <ResponsiveContainer width={width} height={height} {...rest}>
          {children}
        </ResponsiveContainer>
      ) : fallback}
    </div>
  );
};

export default SafeResponsiveContainer;

