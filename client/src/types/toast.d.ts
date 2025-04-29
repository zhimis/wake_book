import { Toast } from '@/components/ui/toast';
import { VariantProps } from 'class-variance-authority';

// Augment the existing toast component types to support our new variants
declare module '@/components/ui/toast' {
  // Extend the ToastProps to include the new variant
  type ToastVariantProps = VariantProps<typeof Toast>;
  
  // Add success variant to the existing variants
  interface ToastProps extends React.ComponentPropsWithoutRef<typeof Toast> {
    variant?: 'default' | 'destructive' | 'success';
  }
}