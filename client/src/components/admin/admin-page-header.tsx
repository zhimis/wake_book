import React from 'react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function AdminPageHeader({ title, description, children }: AdminPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}