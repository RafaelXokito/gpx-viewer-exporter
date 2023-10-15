import React, { useState } from 'react';
import "./ImageDropdown.css";

type OptionType = {
  name: string;
  style: string;
  thumbnail: string;
};

type ImageDropdownProps = {
  options: OptionType[];
  selectedOption: OptionType | null;
  onSelect: (option: OptionType) => void;
};

const ImageDropdown: React.FC<ImageDropdownProps> = ({ options, selectedOption, onSelect }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const selectOption = (option: OptionType) => {
    onSelect(option);
    setIsDropdownOpen(false);
  };

  return (
    <div className="dropdown">
      <div className="dropdown-toggle" onClick={toggleDropdown}>
        {selectedOption && (
          <img src={selectedOption.thumbnail} alt={selectedOption.name} className="dropdown-option-image" />
        )}
        <span className="dropdown-option-label">
          {selectedOption ? selectedOption.name : 'Select a map style'}
        </span>
        <span className="dropdown-caret"></span>
      </div>
      <ul className={`dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
        {options.map((option, index) => (
          <li key={index} onClick={() => selectOption(option)}>
            <img src={option.thumbnail} alt={option.name} className="dropdown-option-image" />
            <span className="dropdown-option-label">{option.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ImageDropdown;