import { DEBUG_LOGS } from '../config/runtimeConfig'

const isDevMode = () => (
  typeof import.meta !== 'undefined'
  && import.meta.env
  && import.meta.env.MODE !== 'production'
)

const shouldDebug = () => DEBUG_LOGS || isDevMode()

export const logger = {
  debug: (...args) => {
    if (shouldDebug()) console.log(...args)
  },
  warn: (...args) => {
    if (shouldDebug()) console.warn(...args)
  },
  error: (...args) => {
    console.error(...args)
  },
}

export default logger
