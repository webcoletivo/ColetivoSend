/**
 * Unificação por abas: o app vive sob /send, mas o código chama /api/... com
 * caminho absoluto em ~36 pontos. Este patch prefixa o basePath em chamadas
 * same-origin para /api/*, exceto /api/auth/verify (endpoint da PLATAFORMA,
 * na raiz do domínio — usado pela barra de abas).
 */
(function () {
  'use strict'
  var bp = '/send'
  function rewrite(path) {
    if (path.indexOf('/api/') !== 0) return path
    if (path.indexOf('/api/auth/verify') === 0) return path
    if (path.indexOf(bp + '/') === 0) return path
    return bp + path
  }

  var origFetch = window.fetch
  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        input = rewrite(input)
      } else if (input && input.url) {
        var u = new URL(input.url)
        if (u.origin === location.origin) {
          var np = rewrite(u.pathname)
          if (np !== u.pathname) input = new Request(np + u.search, input)
        }
      }
    } catch (e) {
      /* nunca quebrar a chamada original */
    }
    return origFetch.call(this, input, init)
  }

  var origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      if (typeof url === 'string' && url.charAt(0) === '/') {
        arguments[1] = rewrite(url)
      }
    } catch (e) {
      /* idem */
    }
    return origOpen.apply(this, arguments)
  }
})()
