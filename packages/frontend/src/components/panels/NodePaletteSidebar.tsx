import { PanelLeftClose, PanelLeftOpen, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodePalette } from '@/components/panels/NodePalette';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { version } from '../../../../../custom_components/cafe/manifest.json';

interface NodePaletteSidebarProps {
  expanded: boolean;
  onToggle: () => void;
  layout?: 'desktop' | 'compact';
  className?: string;
  isRemote?: boolean;
  configUrl?: string;
  connectionError?: string | null;
}

interface NodePaletteFooterProps {
  expanded: boolean;
  isRemote?: boolean;
  configUrl?: string;
  connectionError?: string | null;
}

function NodePaletteFooter({
  expanded,
  isRemote = false,
  configUrl,
  connectionError,
}: NodePaletteFooterProps) {
  const { t } = useTranslation(['common', 'errors', 'dialogs']);

  if (expanded) {
    return (
      <div className="flex flex-col gap-2 border-t p-4">
        <div className="flex items-center gap-4">
          {isRemote && configUrl && (
            <span className="text-green-600 text-xs">
              {t('status.connectedTo', { hostname: new URL(configUrl).hostname })}
            </span>
          )}
          {connectionError && <span className="text-red-600 text-xs">{connectionError}</span>}
        </div>
        <div className="text-muted-foreground text-xs">
          <span>
            {t('titles.appName')} {`v${version}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 border-t px-2 py-3">
      {isRemote && configUrl && (
        <span
          role="img"
          title={t('status.connectedTo', { hostname: new URL(configUrl).hostname })}
          aria-label={t('status.connectedTo', {
            hostname: new URL(configUrl).hostname,
          })}
        >
          <Wifi className="h-4 w-4 text-green-600" />
        </span>
      )}
      <span className="font-medium text-[10px] text-muted-foreground">{`v${version}`}</span>
    </div>
  );
}

export function NodePaletteSidebar({
  expanded,
  onToggle,
  layout = 'desktop',
  className,
  isRemote = false,
  configUrl,
  connectionError,
}: NodePaletteSidebarProps) {
  const { t } = useTranslation(['common', 'errors', 'dialogs']);

  const layoutClasses =
    layout === 'compact'
      ? cn(
          'absolute top-0 bottom-0 left-0 z-40 flex min-h-0 flex-col border-border border-r transition-[width] duration-300',
          expanded ? 'w-full bg-card' : 'w-16 bg-card'
        )
      : cn(
          'flex h-full min-h-0 flex-col border-border border-r bg-card transition-[width] duration-300',
          expanded ? 'w-72' : 'w-20'
        );

  return (
    <aside className={cn(layoutClasses, className)}>
      <div className="flex h-14 items-center justify-between border-b px-4">
        {expanded ? (
          <>
            <h3 className="shrink-0 whitespace-nowrap font-semibold text-sm">
              {t('labels.addNode')}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label="Collapse menu"
              title="Collapse menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="w-0" />
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label="Expand menu"
              title="Expand menu"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className={cn('min-h-0 flex-1', expanded ? 'overflow-auto' : 'overflow-hidden')}>
        <NodePalette iconOnly={!expanded} />
        {expanded && (
          <div className="border-t p-4">
            <h4 className="mb-2 font-medium text-muted-foreground text-xs">
              {t('labels.quickHelp')}
            </h4>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>{t('help.clickNodesToAdd')}</li>
              <li>{t('help.dragToConnect')}</li>
              <li>{t('help.deleteToRemove')}</li>
              <li>{t('help.backspaceDeleteKey')}</li>
            </ul>
          </div>
        )}
      </div>

      <NodePaletteFooter
        expanded={expanded}
        isRemote={isRemote}
        configUrl={configUrl}
        connectionError={connectionError}
      />
    </aside>
  );
}
