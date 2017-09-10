/**
 * @file Shader Utils
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { ShaderChunk } from 'three'

import './chunk/dull_interior_fragment.glsl'
import './chunk/fog_fragment.glsl'
import './chunk/matrix_scale.glsl'
import './chunk/nearclip_vertex.glsl'
import './chunk/nearclip_fragment.glsl'
import './chunk/opaque_back_fragment.glsl'
import './chunk/radiusclip_vertex.glsl'
import './chunk/radiusclip_fragment.glsl'
import './chunk/unpack_color.glsl'

import { ShaderRegistry } from '../globals'

type ShaderDefines = { [k: string]: string|number|boolean }

function getDefines (defines: ShaderDefines) {
  if (defines === undefined) return ''

  const lines = []

  for (const name in defines) {
    const value = defines[ name ]

    if (value === false) continue

    lines.push('#define ' + name + ' ' + value)
  }

  return lines.join('\n') + '\n'
}

const reInclude = /^(?!\/\/)\s*#include\s+(\S+)/gmi
const shaderCache: { [k: string]: string } = {}

export function getShader (name: string, defines: ShaderDefines = {}) {
  let hash = name + '|'
  for (const key in defines) {
    hash += key + ':' + defines[ key ]
  }

  if (!shaderCache[ hash ]) {
    const definesText = getDefines(defines)

    let shaderText = ShaderRegistry.get('shader/' + name) as string
    if (!shaderText) {
      throw new Error("empty shader, '" + name + "'")
    }
    shaderText = shaderText.replace(reInclude, function (match, p1) {
      const path = 'shader/chunk/' + p1 + '.glsl'
      const chunk = ShaderRegistry.get(path) || ShaderChunk[ p1 ]

      return chunk || ''
    })

    shaderCache[ hash ] = definesText + shaderText
  }

  return shaderCache[ hash ]
}