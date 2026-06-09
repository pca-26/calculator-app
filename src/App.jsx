import { useState } from 'react'
import './App.css'

function App() {
  const [display, setDisplay] = useState('0')

  function handleClick(value) {
    if (display === '0') {
      setDisplay(value)
    } else {
      setDisplay(display + value)
    }
  }

  function clearDisplay() {
    setDisplay('0')
  }

  return (
    <div className="calculator">
      <div className="display">{display}</div>

      <div className="buttons">
        <button onClick={clearDisplay}>C</button>
        <button onClick={() => handleClick('/')}>÷</button>
        <button onClick={() => handleClick('*')}>×</button>
        <button onClick={() => handleClick('-')}>−</button>

        <button onClick={() => handleClick('7')}>7</button>
        <button onClick={() => handleClick('8')}>8</button>
        <button onClick={() => handleClick('9')}>9</button>
        <button onClick={() => handleClick('+')}>+</button>

        <button onClick={() => handleClick('4')}>4</button>
        <button onClick={() => handleClick('5')}>5</button>
        <button onClick={() => handleClick('6')}>6</button>
       <button
  onClick={() => {
    try {
      setDisplay(eval(display).toString())
    } catch {
      setDisplay('Error')
    }
  }}
>
  =
</button>

        <button onClick={() => handleClick('1')}>1</button>
        <button onClick={() => handleClick('2')}>2</button>
        <button onClick={() => handleClick('3')}>3</button>

        <button onClick={() => handleClick('0')}>0</button>
        <button onClick={() => handleClick('.')}>.</button>
      </div>
    </div>
  )
}

export default App