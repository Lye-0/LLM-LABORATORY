import { useId, useLayoutEffect, useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
interface Props {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder = '選択してください',
  disabled,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const background = [
      ...document.querySelectorAll<HTMLElement>('.skip-link, .site-header, #sidebar, .site-body'),
    ];
    const previous = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    return () =>
      background.forEach((element, index) => {
        element.inert = previous[index];
      });
  }, [open]);
  return (
    <div className="select-field">
      <label className="field-label" id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectPrimitive.Trigger
          id={id}
          className="select-trigger"
          aria-label={label}
          aria-labelledby={`${id}-label`}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="select-chevron">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="m4 6 4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="select-content"
            position="popper"
            sideOffset={8}
            collisionPadding={12}
            align="start"
          >
            <SelectPrimitive.ScrollUpButton
              className="select-scroll"
              aria-label="候補を上へスクロール"
            >
              ⌃
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport
              className="select-viewport"
              tabIndex={0}
              role="group"
              aria-label={`${label}の候補`}
            >
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  textValue={option.label}
                  className="select-option"
                >
                  <div className="select-option-copy">
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    {option.description && (
                      <span className="select-option-description">{option.description}</span>
                    )}
                  </div>
                  <SelectPrimitive.ItemIndicator className="select-check">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="m3 8 3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton
              className="select-scroll"
              aria-label="候補を下へスクロール"
            >
              ⌄
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
