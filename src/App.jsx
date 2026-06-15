import { useState, useEffect, useCallback } from 'react'
import './App.css'

const FUNCS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  log: Math.log10,
  ln: Math.log,
}

function tokenize(s) {
  const tokens = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') { i++; continue }

    if (/[\d.]/.test(c)) {
      let num = ''
      while (i < s.length && /[\d.]/.test(s[i])) num += s[i++]
      // exponential notation produced by fmt(), e.g. 1.23e+15
      if ((s[i] === 'e' || s[i] === 'E') && /[\d+-]/.test(s[i + 1])) {
        num += s[i++]
        if (s[i] === '+' || s[i] === '-') num += s[i++]
        while (i < s.length && /\d/.test(s[i])) num += s[i++]
      }
      tokens.push({ t: 'num', v: parseFloat(num) })
    } else if ('+-*/^()'.includes(c)) {
      tokens.push({ t: c })
      i++
    } else if (c === 'π') {
      tokens.push({ t: 'num', v: Math.PI }); i++
    } else if (c === '√') {
      tokens.push({ t: 'fn', v: 'sqrt' }); i++
    } else if (/[a-z]/i.test(c)) {
      let name = ''
      while (i < s.length && /[a-z]/i.test(s[i])) name += s[i++]
      if (name === 'e') tokens.push({ t: 'num', v: Math.E })
      else if (name === 'pi') tokens.push({ t: 'num', v: Math.PI })
      else tokens.push({ t: 'fn', v: name })
    } else {
      i++ // skip anything unrecognised
    }
  }
  return tokens
}

// Recursive-descent parser — no eval. Handles + - * / ^, parentheses,
// unary minus, the FUNCS above, constants, and implicit multiplication (2π, 3(4)).
function safeEval(expr) {
  // drop trailing operators/dots so partial input like "5+" still evaluates
  const s = expr.replace(/[+\-*/^.]+$/, '')
  const tokens = tokenize(s)
  if (!tokens.length) return 0

  let pos = 0
  const peek = () => tokens[pos]
  const isValueStart = (tk) => tk && (tk.t === 'num' || tk.t === '(' || tk.t === 'fn')

  function parseExpr() {
    let v = parseTerm()
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tokens[pos++].t
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  function parseTerm() {
    let v = parseUnary()
    while (peek()) {
      const tk = peek()
      if (tk.t === '*' || tk.t === '/') {
        pos++
        const r = parseUnary()
        if (tk.t === '/') {
          if (r === 0) throw new Error('Division by zero')
          v = v / r
        } else {
          v = v * r
        }
      } else if (isValueStart(tk)) {
        v = v * parseUnary() // implicit multiplication
      } else {
        break
      }
    }
    return v
  }

  function parseUnary() {
    if (peek() && peek().t === '-') { pos++; return -parseUnary() }
    if (peek() && peek().t === '+') { pos++; return parseUnary() }
    return parsePower()
  }

  function parsePower() {
    const base = parsePrimary()
    if (peek() && peek().t === '^') {
      pos++
      return Math.pow(base, parseUnary()) // right-associative
    }
    return base
  }

  function parsePrimary() {
    const tk = peek()
    if (!tk) throw new Error('Unexpected end')
    if (tk.t === 'num') { pos++; return tk.v }
    if (tk.t === '(') {
      pos++
      const v = parseExpr()
      if (peek() && peek().t === ')') pos++ // tolerate missing close paren
      return v
    }
    if (tk.t === 'fn') {
      pos++
      const fn = FUNCS[tk.v]
      if (!fn) throw new Error('Unknown function')
      let arg
      if (peek() && peek().t === '(') {
        pos++
        arg = parseExpr()
        if (peek() && peek().t === ')') pos++
      } else {
        arg = parsePrimary()
      }
      return fn(arg)
    }
    throw new Error('Unexpected token')
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new Error('Unexpected token')
  return result
}

function fmt(n) {
  if (!isFinite(n) || isNaN(n)) return 'Error'
  const r = parseFloat(n.toPrecision(12))
  const s = r.toString()
  return s.length > 13 ? n.toExponential(5) : s
}

const OP_CHARS = '+-*/^'

export default function App() {
  const [expr, setExpr] = useState('0')
  const [prevExpr, setPrevExpr] = useState('')
  const [justCalc, setJustCalc] = useState(false)

  const clear = useCallback(() => {
    setExpr('0')
    setPrevExpr('')
    setJustCalc(false)
  }, [])

  const backspace = useCallback(() => {
    if (justCalc) { clear(); return }
    setExpr(e => (e.length <= 1 || e === 'Error') ? '0' : e.slice(0, -1))
  }, [justCalc, clear])

  const digit = useCallback((d) => {
    const wasCalc = justCalc
    if (wasCalc) setPrevExpr('')
    setJustCalc(false)
    setExpr(e => {
      if (wasCalc || e === 'Error') return d === '.' ? '0.' : d
      if (e === '0' && d !== '.') return d
      if (d === '.') {
        const seg = e.split(/[+\-*/^()]/).pop()
        if (seg.includes('.')) return e
      }
      return e + d
    })
  }, [justCalc])

  const operator = useCallback((op) => {
    setJustCalc(false)
    setPrevExpr('')
    setExpr(e => {
      if (e === 'Error') e = '0'
      const last = e[e.length - 1]
      // allow a leading minus to start a negative number
      if (op === '-' && '*/(^'.includes(last)) return e + '-'
      if (OP_CHARS.includes(last)) return e.slice(0, -1) + op
      return e + op
    })
  }, [])

  // Insert a value-like token (digit-less): function-open, constant, or '('
  const insertValue = useCallback((s) => {
    const wasCalc = justCalc
    setJustCalc(false)
    setPrevExpr('')
    setExpr(e => {
      if (wasCalc || e === 'Error' || e === '0') return s
      return e + s
    })
  }, [justCalc])

  const closeParen = useCallback(() => {
    setJustCalc(false)
    setExpr(e => {
      const opens = (e.match(/\(/g) || []).length
      const closes = (e.match(/\)/g) || []).length
      const last = e[e.length - 1]
      if (opens <= closes) return e
      if ('+-*/^('.includes(last)) return e
      return e + ')'
    })
  }, [])

  const square = useCallback(() => {
    const wasCalc = justCalc
    setJustCalc(false)
    setPrevExpr('')
    setExpr(e => {
      if (e === 'Error') return '0'
      const last = e[e.length - 1]
      if (!wasCalc && '+-*/^('.includes(last)) return e
      return e + '^2'
    })
  }, [justCalc])

  const percent = useCallback(() => {
    setJustCalc(false)
    setExpr(e => {
      const match = e.match(/^(.*[+\-*/])?(-?\d*\.?\d+)$/)
      if (!match) return e
      const [, prefix = '', num] = match
      return prefix + fmt(parseFloat(num) / 100)
    })
  }, [])

  const equals = useCallback(() => {
    if (justCalc) return
    try {
      const result = safeEval(expr)
      setPrevExpr(expr + ' =')
      setExpr(fmt(result))
    } catch {
      setPrevExpr(expr + ' =')
      setExpr('Error')
    }
    setJustCalc(true)
  }, [expr, justCalc])

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (/^[0-9]$/.test(k)) digit(k)
      else if (k === '.') digit('.')
      else if (k === '+') operator('+')
      else if (k === '-') operator('-')
      else if (k === '*') operator('*')
      else if (k === '/') { e.preventDefault(); operator('/') }
      else if (k === '^') operator('^')
      else if (k === '(') insertValue('(')
      else if (k === ')') closeParen()
      else if (k === 'Enter' || k === '=') { e.preventDefault(); equals() }
      else if (k === 'Backspace') backspace()
      else if (k === 'Escape') clear()
      else if (k === '%') percent()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [digit, operator, equals, backspace, clear, percent, insertValue, closeParen])

  const fontSize = expr.length > 12 ? '1.6rem' : expr.length > 8 ? '2.2rem' : '3rem'

  return (
    <div className="calc">
      <div className="display">
        <div className="display-prev">{prevExpr}</div>
        <div className="display-val" style={{ fontSize }}>{expr}</div>
      </div>

      <div className="grid sci-grid" onMouseDown={e => e.preventDefault()}>
        <button className="btn sci" onClick={() => insertValue('sin(')}>sin</button>
        <button className="btn sci" onClick={() => insertValue('cos(')}>cos</button>
        <button className="btn sci" onClick={() => insertValue('tan(')}>tan</button>
        <button className="btn sci" onClick={() => insertValue('√(')}>√</button>

        <button className="btn sci" onClick={() => insertValue('ln(')}>ln</button>
        <button className="btn sci" onClick={() => insertValue('log(')}>log</button>
        <button className="btn sci" onClick={() => insertValue('π')}>π</button>
        <button className="btn sci" onClick={() => insertValue('e')}>e</button>

        <button className="btn sci" onClick={() => insertValue('(')}>(</button>
        <button className="btn sci" onClick={closeParen}>)</button>
        <button className="btn sci" onClick={square}>x²</button>
        <button className="btn sci" onClick={() => operator('^')}>xʸ</button>
      </div>

      <div className="grid" onMouseDown={e => e.preventDefault()}>
        <button className="btn fn" onClick={clear}>C</button>
        <button className="btn fn" onClick={backspace}>⌫</button>
        <button className="btn fn" onClick={percent}>%</button>
        <button className="btn op" onClick={() => operator('/')}>÷</button>

        <button className="btn num" onClick={() => digit('7')}>7</button>
        <button className="btn num" onClick={() => digit('8')}>8</button>
        <button className="btn num" onClick={() => digit('9')}>9</button>
        <button className="btn op" onClick={() => operator('*')}>×</button>

        <button className="btn num" onClick={() => digit('4')}>4</button>
        <button className="btn num" onClick={() => digit('5')}>5</button>
        <button className="btn num" onClick={() => digit('6')}>6</button>
        <button className="btn op" onClick={() => operator('-')}>−</button>

        <button className="btn num" onClick={() => digit('1')}>1</button>
        <button className="btn num" onClick={() => digit('2')}>2</button>
        <button className="btn num" onClick={() => digit('3')}>3</button>
        <button className="btn op" onClick={() => operator('+')}>+</button>

        <button className="btn num zero" onClick={() => digit('0')}>0</button>
        <button className="btn num" onClick={() => digit('.')}>.</button>
        <button className="btn eq" onClick={equals}>=</button>
      </div>
    </div>
  )
}
