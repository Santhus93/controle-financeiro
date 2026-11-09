import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

const FALLBACK = 'Ocorreu uma falha ao acessar os dados na nuvem.'

describe('getErrorMessage', () => {
  it('devolve a mensagem de um Error', () => {
    expect(getErrorMessage(new Error('Falha ao salvar a fatura.'))).toBe('Falha ao salvar a fatura.')
  })

  it('devolve a mensagem de subclasses de Error', () => {
    expect(getErrorMessage(new TypeError('Valor inválido.'))).toBe('Valor inválido.')
    expect(getErrorMessage(new RangeError('Fora do intervalo.'))).toBe('Fora do intervalo.')
  })

  it('devolve a mensagem vazia quando o Error não tem mensagem', () => {
    expect(getErrorMessage(new Error(''))).toBe('')
  })

  it('devolve a mensagem padrão para string', () => {
    expect(getErrorMessage('algo deu errado')).toBe(FALLBACK)
  })

  it('devolve a mensagem padrão para null', () => {
    expect(getErrorMessage(null)).toBe(FALLBACK)
  })

  it('devolve a mensagem padrão para undefined', () => {
    expect(getErrorMessage(undefined)).toBe(FALLBACK)
  })

  it('devolve a mensagem padrão para objeto comum', () => {
    expect(getErrorMessage({ message: 'não é um Error' })).toBe(FALLBACK)
    expect(getErrorMessage({ code: 500 })).toBe(FALLBACK)
    expect(getErrorMessage([])).toBe(FALLBACK)
  })

  it('devolve a mensagem padrão para número e boolean', () => {
    expect(getErrorMessage(42)).toBe(FALLBACK)
    expect(getErrorMessage(false)).toBe(FALLBACK)
  })
})
