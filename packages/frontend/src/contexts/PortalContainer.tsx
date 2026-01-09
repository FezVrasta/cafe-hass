import { createContext, useContext, useRef } from 'react';
import type { ReactNode } from 'react';

interface PortalContainerContextType {
  container: HTMLElement | null;
}

const PortalContainerContext = createContext<PortalContainerContextType>({ container: null });

export function usePortalContainer() {
  return useContext(PortalContainerContext).container || document.body;
}

export function PortalContainer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Provide the div as the portal container
  return (
    <PortalContainerContext.Provider value={{ container: ref.current }}>
      <div ref={ref} className="contents">
        {children}
      </div>
    </PortalContainerContext.Provider>
  );
}
