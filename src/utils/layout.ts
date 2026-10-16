export const getConversationWidthClass = (width?: 'narrow' | 'default' | 'wide'): string => {
  switch (width) {
    case 'narrow':
      return 'max-w-3xl';
    case 'wide':
      return 'max-w-7xl';
    case 'default':
    default:
      return 'max-w-5xl';
  }
};
