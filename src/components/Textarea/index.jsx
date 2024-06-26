import React, { forwardRef, useEffect, useState } from 'react'
import { classnames } from '../utils';
import Proptypes from 'prop-types'
import { Button } from '../Button';
import styles from './textarea.module.less'

export const Textarea = forwardRef((props, ref) => {
  const {
    onChange,
    onEnter,
    placeholder,
    className,
    showClear,
    disable,
    children,
    rows,
    maxHeight,
    value,
    defaultValue,
    transparent,
    onClear,
    dataTestId,
    ...rest
  } = props;
  const [content, setContent] = useState(value);
  const [height, setHeight] = useState('auto')

  useEffect(() => {
    setContent(value);
  }, [value])

  function handleChange(event) {
    setHeight('auto');
    setHeight(`${event.target.scrollHeight}px`);
    setContent(event.target.value);
    onChange && onChange(event.target.value);
  }

  function handleClear() {
    onChange && onChange("");
    onClear && onClear();
  }

  const handleKeyPress = (event) => {

    if (event.shiftKey && event.key === "Enter") {
      setContent(content + "\n");
      event.preventDefault();
    }
    else if (event.key === "Enter") {
      onEnter && onEnter(content, event);
      event.preventDefault();
    }
  }

  return (
    <div className={classnames(styles.textarea_box, className)} data-testid={dataTestId}>
      <div className={styles.inner}>
        <textarea
          ref={ref}
          rows={rows}
          style={{ height }}
          onChange={handleChange}
          placeholder={placeholder}
          onKeyDown={handleKeyPress}
          className={classnames(styles.textarea, transparent && styles.transparent)}
          value={content}
          {...rest}
        />
      </div>
      {showClear && <Button className={styles.clear} type="icon" onClick={handleClear} icon="cancel" />}
    </div>
  );
});

Textarea.defaultProps = {
  showClear: false,
  disable: false,
  defaultValue: '',
  maxHeight: 200,
  placeholder: '',
  rows: '1',
  transparent: false,
  value: ''
};

Textarea.propTypes = {
  showClear: Proptypes.bool,
  transparent: Proptypes.bool,
  onClear: Proptypes.func,
  className: Proptypes.string,
  onChange: Proptypes.func,
  disable: Proptypes.bool,
  placeholder: Proptypes.string,
  maxHeight: Proptypes.number,
  rows: Proptypes.string,
}
