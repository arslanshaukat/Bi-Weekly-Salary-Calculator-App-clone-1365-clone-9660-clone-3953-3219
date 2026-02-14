import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

/**
 * Optimized SafeIcon component.
 * It now expects the icon component to be passed directly as a prop
 * to avoid importing the entire icon library twice.
 */
const SafeIcon = ({ icon: IconComponent, className, ...props }) => {
  if (!IconComponent) {
    return <FiAlertTriangle className={`text-orange-500 ${className}`} {...props} />;
  }

  return <IconComponent className={className} {...props} />;
};

export default SafeIcon;