export type StackType = "modular" | "sts" | "integration";

export interface TemplateMetaForUI {
  id: string;
  displayName: string;
  summary: string;
  badges: string[];
  stackType: StackType;
}

export interface TemplatesGridProps {
  templates: TemplateMetaForUI[];
  onCreate: (templateId: string) => void;
  className?: string;
  isCreateDisabled?: boolean;
}

export function TemplatesGrid({ templates, onCreate, className, isCreateDisabled }: TemplatesGridProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-md border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{t.displayName}</h3>
              <span className="text-xs font-medium text-gray-500">{t.stackType.toUpperCase()}</span>
            </div>
            <p className="mb-3 text-sm text-gray-600">{t.summary}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {t.badges.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                >
                  {b}
                </span>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                aria-label={`Create from ${t.displayName}`}
                data-testid={`create-${t.id}`}
                disabled={isCreateDisabled}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onCreate(t.id)}
              >
                Create
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TemplatesGrid;
