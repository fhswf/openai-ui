import React from 'react';
import styles from "./avatar.module.less"
import { classnames } from '../utils';
import imageUrl from '../../assets/images/avatar.png'

export const Avatar = ({ src, altText = 'User Avatar', className, size, circle = true, onClick, dataTestId }) => {
  return (
    <div className={classnames(styles.avatar, circle && styles.circle, className,)} onClick={() => onClick()} style={{ width: size, height: size }} data-testid={dataTestId}>
      <img src={src || imageUrl} alt={altText} />
    </div>
  );
};


