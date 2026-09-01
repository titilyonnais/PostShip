import { ImageResponse } from "next/og";

export const alt = "PostShip — surveillance post-déploiement";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The real brand mark (chevron + dot), inlined as a data URI — next/og's
// Satori renderer can't read local files, only <img src> URLs/data URIs.
const LOGO_MARK_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAAAAAAAAQCEeRdzAAAQAElEQVR4nO3dB1QU5/o/8HcX2KUpKoLGLnoVW4ydpmJXQBBbVERUUIoU6b0XqdJ7kyYgglItUWNisGGJ3SQ20BhERYHdnd2F3f2fIfq/Jr/cJCqwOzPP5xzPzc01zBvPne+89XlpCABAWdLibgAAQHwgAACgMAgAACgMAgAACoMAAIDCIAAAoDAIAAAoDAIAAAqDAACAwiAAAKAwCAAAKAwCAAAKgwAAgMIgAACgMAgAACgMAgAACoMAAIDCIAAAoDAIAAAoDAIAAAqDAACAwiAAAKAwUgSAUv/+aNiwofhfyooQotFpdO7r162iFy0t4m4aABKNsAEwSX0CWrliqfrSxbpLxo9T01RVVRmLEOqPEKLTaLSOt21tzY2NTQ3nfrh4uvbY8YaLl64IRCKRuJsNgEQhXABMmTIJeXu46K5asXSvklL/5QKBQK6rqwsJBML//3vwF11VZTAaNnSo0XwdrWCnvXsuXbp8JTkyJv7gsePf/Pc3AkBxhAoABztrZW8Pl6jBgweZcTgYncVi/8/f29Ul6P6FeDwajUbT0NHW0NDUmGORc6DIwcM74EZ7e3ufth0ASUSIAJCRkUYJsVFTrHbvLMEwztS/e/H/Ct4jwDAuotFoC62tLL6dOnWy9W4r+9L7P/3ca20GgAgIEQBZ6UlTtm3bcryjrX3E5/wcPAg62tsHamnMKT5RVzHefLdt6KnTZ3uuoQAQjMQHQHhYgLKpyabSz335P8ThYLQhKiohleXFkz29A6wTktNhPAAoSaIDYMnihch+j1UMh8OZ0tM/m9/Zieh0+pa4/eHq06dP2+7o7HmrvaOjpx8DgEST2ACg0WjIx8tNV0ZGxhTDsF55hlAoRCwWe+bO7VvPTlKfaLfb2uHg7Tt3e+VZAEgiiQ2AVSuXIW3Nuc5cLkbv7Wd1dLAGzZk9s+jUicp5bh5+bvmFxbzefiYAkkBiA8DUZJM6nS61tK/27uC9DKV+/eyz0hNn62hr7Hb18LvT1tbWNw8HQEwkMgAGDhiA5syasZTP58v25XM7u7pQl0Cgtcvc7PuZM6a72Dq45l681NCXTQCgT0lkAIwZMwqpqqpoCgSCPn9291JhB2vQl9Om5hyvKV8YFBrptD8uqbXPGwIAVQNgkvpEpCAvP4bN4YitDVwuF8nIyJhFhwfPm6+jaWvv6Hb66dNfxdYeACgTADQ6jYlo3Qd7xArvgbDYbHVDg1XHZs6YHunlExRUVHyIL+52AUDqAEAihM/89/rs/7/FZnNkVFVUvHOzUhYtWKBt5+kdeK21FUYFgPgkMgDoUnQuDdEkaldOZ2cn6urq0tq1c9t387U1g9w9/aKra4/D+WJAaBIZAI8fN4owLrcZ3wwkSWf48bawWGzFcWPHRJaV5C3HTxb6+AffbW19I+6mAUCeAHjw8BFqbX3TMGjQQCNxrAT8Ex6fj+9UXGq1e0e97gJtfzdPv4SauhPibhYA5AiA5uYX6O79n84s1p0vxDCBxMwF/EVvYMA4tbHxh0vz9bIPFDr5+oXcbX0DvQFAHBIZALjSsopLyxbrXkUIzUES7F1vYIX1bvN63QU6QW6e/vG1dceh6hAgBIkNgMOHjwqd99omjlMbm8/nS/bK2++9AdaA8ePG7j9ckmdwIL/I2cc/5MfXr2GlAEg2iQ0A/GhubHxKUXpK3G4+n6+DCIDH6+4NLLbctePcooXzIwJDIiKLSw9LdnoBSpPYAMBl5eQJ9fVW2K5ZrXe2g8UagAjg/UrBmDGjgwsOpBsYGeq7uHr4/vD06TNxNw0AYgUAznz3nhtfVB22mDtnVjGLxZJBBIEPWzo7afM2rFtzWmPu7MSI6Ljg9MzcNrwGAQCSQuIDAF9j32Syo7y4MNts3pzZGSw2WxERBN4bYLPZjCFDVJyTE6L1jAz1Pdw9/atu3Lwl7qYBQIwAwD1pbEJ6hhuKS4sOPF+yeGE+h8MZJUkbhP5JZ2cX/mvSkkULK8+eqilMSs30DguPaeqtSkcAkCoAcG/evEUrDdZ+FxMVprvHyqKwq6tTq7vuP4HgLzyDwdjq7eGydNmSRYFBIeFpdce/EXezAIURJgBw+PjZ0dnj8e3bd5fGRIYky8nK7sDX4Ymk+4QhizV05owvU8sPFW44WFLmHhC078rTZ3DUGPQ9QgXAe9m5+di9+z/tzM9JuzF27Oh9bDZHDhEMl8vrXjLcYWby/dLFugmBoRH7cnILoAYZ6FOEDADc+QuX0PzFq+JTk/bfWK2/KhPDsPFEm2F/t2Qop6o62D0jJd5o88b1Pj7+weWXLl8Rd9MARRA2AHC//daM1qzbcjbQ32u+i6NdKoPBWCPpuwb/ZpJQXXehzuGTdUfKM7IOeEdEx/306tVrcTcNkByhA+A9/8Cw5ssNV40T46I8R48a4c9mc5iIgPBJQikpqXUuTnZLDFfrRYVFxMTm5R+EpQLQa0gRALjauhPo1q07++JjIy4aGeilYhg2UUCwIQEOH8Z0dLAGjB41IjQrLXHDOmNDb1//kLobN2+Lu2mAhEgTALimp8+Q8XqTb5327tEJ8PWMYzKZJjweMe/44PM7EY3W+ZXeyuW1OloaB1PTs/0io+MftsG15qAHkSoA3tsfl/yq4cq1rUnx0d9/OXVKOIvNHkikjUPv4U3mcDiIyWRs8XJ3XmlsZBAZGBKRUFpWAcMC0CNIGQC4cz9cQLpL9DPCQvzrd5iZpCCRaAF+ISgRCQRC1MFiDVJTGxtemJe5afOmDb7BoZE1V69dF3fTAMGRNgBwb96+Rda2jndOnTm7JCYixGfkyBEebDabkBOEOHyFg0ZDXxnoLa9etFCnLCPrgF9EdNx9WC0An4rUAfBeeUVl1+WGqwFR+4LObFi/JpHH43/Z1dWFiOj3YUH3asEGFye75YYGq+KiYxP3Z+XktRNwlAPEjBIBgMPP42/auvP7M2e/1wny9w4ePFjZjsPhSGS9wY9YLVAaPXqkf2pS7KatW74O8PYLLvmh/oK4mwYIhDIB8F5G1oGO+vMX98bGhJ9YumhhLMblTpTEysMfs1rA53dO1NKcW3ys+rBZyaEKv+CwyIampqfibhogAMoFAO7O3ftohZ7xMUcHm4uebk5hAwcOsMK71USGYVxEp9NX7ty+dZGB3oqM6NjE8NT07Of4KgIA/wslAwCHLwvuj0t+c/KbM9bRkaG1y5YsiuFxuRO6CNwbwIcF+CSnklI/u6jwoHVbNm2ICA6LTD9aWUPMzRCg11E2AN67feceWmWwrsbBzvq8l4dz8KCBA6w5HIyGCAyvk8BisYdNnaIeX1acZ1p3/GQgvmx45SosG4I/onwAvO8NxCWktH5z6ts9MZGh1cuW6sbwePzJRF0p+GOVYjRbf+Xy6sW6Cypy8wqDImMSbjyD2gPgHQiAD9y5ew+vOnTccteO837e7gFDh6jacTBMmoi7CP+wbIhh+PzAWlub3SvXrjFMi4yJj8zMznsBJckABMBfSM/MbT9+4pRT5L6gyrXGhtFdXV2z8duBiQyfH2Cx2PKDBg10iosJ37ht6+bI4LDIjMqqWpgfoDAIgP+hsekp+tpkx3dmplvm+/u4u40ZM8qNzeYoELk3gMOHNSwWa8S0qZMSDpfkm546czbELyDsaMMV/BY2QDUQAP8gr+Ag99iJb4ICfD2qd5htjZSi05dyCXrC8C9uMZq1dPHCI/O1NWtKy44EBYdGNOAVmAF1QAD8Cy0tL5GNnfP16toTy0ICfaxnfDUtAMMwVfyQDpHhvZl3+wcMtm/bvFx/1bLcjKwD4ZHR8U9YbLa4mwf6AATARzh2/CQ6+925VC93pzpbm91hioqKW8gwkfb7/gEOo3//fpbeni7r1601ik9KyUiAm4zIDwLgI+EvvG9AaGP5kSqTiLCgsqVLFobx+fxJeF0/osP3D3R1cZTHqY0NSoqP2rZxw9rw2PjkA1XVdcTdHQX+FgTAJ/rxxi20Qt/4qMXObWd8vNy8Ro0cbo+XJyf6JOH7Y8d8Pn+8tua8LB2teRYVR2tCo2ISaq5cvSbupoEeBgHwmbJy8ttPnDzt4e/redhk84ZwKSn6ErzmPxlwuVx8olBjnbFhtd6q5dWHyo6EBodFXnrypFHcTQM9BAKgB+C3+lhY2l4pP1K51N/HfdfcObP9MAwbQeRThu/hPRr8QBGdTl+9fdvmlXorlxUUFJWE749L+qX5RYu4mwc+EwRADzp2/Bv07dlzmTaW5rXuro5+gwcPsuBwMCkyDAveTRTK9O/fb6ers/3atcar0/fHJcfmFxa/YLFgxYCoIAB6odu8Pz75eXXdcavQIN8SY6PVYQKBQJOIF5b8FbxXg5ctHz5smHtSfJSJjZVFbHBYZGbpoYoOcbcNfDwIgF7yyy8P0cbN28+uMzZcGOjnaTNpkroXl8tVJcOwAIdvje7s7BwxfpxaTEFuxi7LXTsj4hJSCquq64i/HEIhEAC9rPxIVefJU2fiXZzsj1jvNg9QVh5khpciI8Ow4INCpeo6Whq587U1LWuPnQwP3RdV2XAFVgyIAAKgD3R0sPDry5oOlR3Z6e/rUWRspB8iEAg1yDIswLPs/YqBwarlR5csWnCqpvZ4aGxCytnLDXDGQJJBAPTxceONm81OGxsZfB/k7209ZYq6J4Zxh5JlWNC9YtB99Ji2dOMG4yUG+ivLcw4URkTHJl7Bi7ICyQMBIAZHKms6vzn1bYK9nVWFg52172Bl5Z0cDofQdQc+JBSK8BUDGp1OX29rs9tww7o1RfmFxZEp6Vn3m5ogCCQJBICY4IdtwsJjnh0ur7T09/UoNDYyCJGWll6Ad6XJ4l2NQoaSUv8dbi5715uZbslJSE6PS0xOf8JiscTdPAABIH4///IAmWyzOKe3armut4fLTk2NuT5cLncM0cuRfQgf4rBYrH5KSv0cQgJ9tm7dsjEzJS07Ib+w+LeODlg9FCfoAUiIumMnRadOf5ttYb690tXJ3n30qJHWHA5HAf+KksXvh43YyuPUxngkxkaY2ViZJ6VlZKflFRS3trdDEIgDBICEXfKRkpr5qrKyxtXF2aHQfLtpgJyc7BoMHxaQY3rgw8tMvhinNiY0fn/ELqvd5gmR0XHZRcVl7WTq+RABBIAE+vX5b8jR2eNGYVGJcWiQr9GSxboBAoHgK7IsG/4pCMaMUxuzPyczxWaXuVlcRHR8XnXNMZgg6CMQABLs6rUf0UqDdZXrjA1PBvh5Wk+ZpO7G5XGH4F1pEgbB+LlzZiWVlxbY/nD+Ymx8QkpBZc0xrHuTAeg1EAAEUH6kCjvxzZn99raWh+z2WHqqqgw2xzAuk0zzAzj8GPW7XYXpOloatvXnL8bGJaYerKyu40EQ9A4IAILAl83wZcOi4rI9vl5uBzZtXBsgDmVg/gAAEABJREFUJyenx+WS6yP5312FaJq2lkaOtpaGPR4E8YmpJZXVdXyy7JWQFBAABNPY2ITXHmjIysnTDw7wXrtwgY6fUCicTrb5gQ+2F3+lraWRp62lsff8hUt4j6C0sqoWgqCHQAAQ1MVLDWjZqjUVa4wMjgX5e1lOnTLJlcvlDSPbLDr+xX/XI5ihpTkvX0tznmP9hYtxsfEppVX40AB8FggAgjtaWYOdOv1tnMVOs0MuTnauw774YjeHw5En2/zA+x4BoqEZ2poaedqa8xx/qL+YEJeYWlJVXUf80sxiAgFAAnhFnriElOcVR6sc7fdYHdhlbuajqKiwnsPB5wdINmb+YGigo62Zo6Ot6VR//mJSXGJqUVV1HYt0/769DAKARPCDNi7uPjdKDpVvcHa0W752jYEfnUbX7t5IRDIfDA2mamtppGlrzXM6f+FyUnZuQf7Rqpo2/Ag2+GcQACR05ep1tHnrzpP6eitPuTjZmc7X1vDq6hJMINtE4Z9WDSZoac5NmK+juff+T45paRk5B/IKDr6ELcZ/DwKAxGrrjgtr647nme8wPeK019ZGfeIERx6Pq0q2jUT/DYLuOUG1cWPHRMbHhDtY796Zm5yWlVlceriptfWNuJsokSAAKCA7t6C95FBFuIOtVZGdraXLEFUVvFox6SYK3+N3duK/hquNHeOTEBth7epkX1ByqDw9JT37flPTU3E3T6JAAFAEG68/EBHztKj4kIOtze5s8x3bvJWU+q/HMIxO8iBQVlVV2evm4rDL1GRTxeGKyuSCopJL+DAJQABQTmPTU+Tq4XvzYEnZ167ODroG+it95eTkFpNtR+GH8L0RLFaXwoABSqZ2eyy37DAzOV5VcywtKyf/2Pfn6gVkDcB/A3oAFHX9x5toi6n5WY15c84GBXiv012g44WQaCZZrjX7m8IkUnQ6XX/TxrX6G9YZXb546UpSVEz8wZq6E589McIc1B/JqQ6UQkJhf4QQHdHprM52No/9/BWSVBAAFIfvKFy+ak25oYFejZuLww4tzXkufD5vHH5Cj6zwLz6+R4JGo83V0pybf7i0wPxAfpGDu5f/jba29o/6WcwB/ZDaet0Ro1bMW9V//IjFsspK45FINLT73aLRXnaysaaOR8/P/VZ/s/ZB8anb7Y+fI0kCAQC6VdXU8Y6d+CZtl7lZyR7rXdbqEyc48Hi8IWTbWvznvQQY1r2paKHlbvNvJ6lP3LXZ1Lz8+fPf/vGfpdFoaNIuQ9Wpe9a6KY4aYoaEosHCzi4kEgjx3YrvHoCGMgcoTpObO1l/qPa0gMm7DKselJ4Oux5ReIP3RjIqIEEAgD/c9pOSlvU2v7Bkn8UO0wIXJ/u9w4d9YcHBMCWylC7/X0HQ0d4+cL6OZnFVRcm2FXrGJa9bW/+2q6+b4b58xNLZaQJe59gu9p82Wn04lyIQIYGAjwQ8JCsly9g4xWqN3vDFs3y+s4yMf3X9ZyRuEADgL48exyWmPqs4Wu1ia2OZsdVko9tQVVVTDoYxyDxhxmKxZWZ8NS2zuDC7Sd9ow/nOzv/b+5FTHYiWlwaZDP5qQlYnC5P9mJ+P9w46WZhif7VhcStKg0ed3h7i3Hz+FhInCADwPzU9fYbcPH1/Tk7NsHB02JNqZrrZvX///uvIvHTIZnMUly1dnOHmslcjdF/0H/YTSyvIocU5XssGf/Wf7E42xvzUZwi4fMQYqOikm+nRemKjT+ibO4+RuEAAgH+1dLjX2eNqbl7RRjcXh/mr9Vd6KijIryLlYSOEEIZxptjZWNoXFR8Ke/Kk6f///RmuW1S/WPBVJr+d/ckv/3sCXieS/0I5QDvatr7OyP2skC+euRYIAPCv3bh5q/sOg9mzZpxzdNijv8ZQ353BYMwn2x6Cri4BUlVVsdltvj3NyzeoezJAefp4NMncwL2ThY3usedwuNJDNKftm2imp30vs0osXSoIAPDR8F10Jtssahcu0K7z9XJbt3CBtptIhObweFzSBAGPxxtuvGa1fnhUXEF7ezuasGX5cJl+8ts7WT1bekDY2anxn6+XrLqfW1srEsMZDQgA8Mm++75e9N33RofXGOpX7rW32aylOc8VITSVDEHQ1dWFRo8aaTBtsnpB/bWraMTSOXoCLn9QTz9HwO9Cg6aobVKZObG25fJd1NcgAMBnO1pV21lZXZdvtFq/zMHeeru25ry9IpFoAo9H3F2FIpEIMZnMGZMnTpC/wX3FURg2eIkQX+Pv+QchKVmG5lCtqQotl++yUR+DAAA99sIcrarBjlbVpG5cb1zo6uywY+aM6Q58Pl8N319ATCLVaZMnD6xte8yRkpUZL/zzen9PPUUkGqqkNhzfPfgQ9TEIANDjDh0+0nGksiZhq8nXefZ7LLdOnDDerqtLMJGAf9RMGp3WDwlE8iIRGtKLz1EQCYXDIAAAaeBf/QsXLretW7P6/CT1CcYIETIA6Pgv0e//2asfSxFCUkgMoAcAetz48eOQ817beVs2b3CVk2Wu4XJ5Yvk/dw/gSdHpLJoUjU2joZcIoaG99Rw6nd6CxAACAPSYMaNHIWsri1lmpptdVFVU1nM4HGkiHy+mIdrbXx4+buO+ahMJOwVPEQ1N641bmmk02mvs5dt/PoHUCyAAwGcbPXoU2mNlMdnU5GvXIUNUt2AYl4GfJyAyGg2hzq6uu3fu329rvfUQcV+1nWMMVNTrPu3Xw4RdXdebL9wWS9FCCADwyZSVByGnvXvUdpqZOg0ZomKGYVxF/I4CMqDTpVDLy1cnb929h1Abhloa7tWMXq0d0MXhMnv0OTJSiPW0paKloe/3AOAgAMBHU1RURGamm0fstbexH6c21gLDsIFkefHfk5WV7Th16szR35pfdP/3X0pP3R6tr1WDaGhdTw4DpJjMx40158v5beL584MAAP+avLw82mFmomxtaW4zWX2iLY/PVyV6V/+v0Ol0hGFYSVpm7qP3f6+p7gJ6UlMfNHbN/JWdLEwB9QAppgxqf/As5Eb8oTYkJhAA4F/ZuGGtooero/lX06ft5fN5Y1hscn3xPyQvL/86L/9g2KXLV/7w9xsCc26qzproLTd0UBx+mu9z0KToSCQQlVwOzM7hvRbb+w8BAP6+7JWRob70XjtrUy3NeW4ikVCdjF/8D8nKMtHDR49cPX0Dn/zhf0AIdTx+js6Y74tfVhw4itFf3ulTQwB/+aWZjDOXfDN3NVbXI3GCHgD4S5oac1FwgLfxwgXaHiIRmkuGAz7/hMlkojdv3kZs3mqe2/xu7P9n+IGdbzb5OS/K9nytOHJIYCeHK/0xfzBSsgwk5HUePO+SZHkvp0bsaQoBAP5g9swZyNHBZpHhaj0fWVnmYvzePbK/+Dh5eTnU3NwSvm2nlec/XRrS0nAP1eq5hM0O2Hl+jKFOMF1aWgfvDYjwKkl//sOiIUSj0xFdRhr/8j94efnevsv+WTkvLt5BkgACAHQbOXIEvntv5s4dWz0V5OXxsl80vGIu2UlLSSFZObmWK1eve1ja7M29/uONf/XPsZ61oLMW4WeHak1dqL5Df9VQrWkbmYOUNKVkZYYhEfp9kpCGuKJOwWteG+t66+1HFT8XHK94Ul3fhlcPlhQQABSnpKSEXJ3t1XZu3+o6RFV1B4ZhTDabg8hORkYGH++3N79oORgTnxwZFh7zGMM+vthH8/nbwubzt2tllZVqB6iPUug3+ouhIqHwC/zdotHpLdzXb39rvf34DftXfCex5IEAoChFBQW03cxksI2VhaP6xAlWXAwbhN8fSPZJTQaDgWSkpZ/dufdTQXFpWfbBkrKHH9b9+1Tc122ouf4Wu7n+1kNxHOv9VBAAFGS8ZrWcr5fbrhnTpznxeLzRZJ/Zx198fIJPJBLdu3b9RnpBUUlRQVHpq44OybicQ5wgAChk8aKFyM/bbaOW5jxvkUj4ZQfJX3w6nYbv6MPvBLz4Q/2F5LjE1IrqmmMcMlYy/lQQABQw/cupyM3FQXeNoYEfgyGziOwz+/iLLycrhzgYdrq07EhiRtaB6u/P1Qvhxf+/IABIbOSI4ch2j+UUi53bfAYqKW1kczh0Ms/sS0lJITk5WQGbzak5dPhIQmxCypnLDVfF3SyJBgFAQv0UFdHOHaZfuDjZOY8YNsySzeEoknnr7rsXv/PFi5cV+UUl8Tm5BRcarlwTd7MIAQKAZNYZG8oH+HlaTpms7sLl8oaReZz/7sXnNje3HE5MyYhPTcu+0tj0+TP6VAIBQKKtuyGBPusX6Gj5CoTCL8l2PPcvXnx2c/OLksTk9ISU9OybTU1Pxd0sQoIAIEEZrqAAb01jI4MAWVnmcgqM8dnNL1qKElMyElJSM+/gF5iCTwcBQFADlJSQi7P9WPPtW71VVbur8UiT9eV/9+KzXrx4WZSclhmfnJp1r7ERuvo9AQKAcGjIfKdpfxdHO/uJE/6zF8MwZbJu3f1vV7+lKCk1My41LeveE3jxexQEAIEsWbwQ+Xq7b9HRmufX1dU1kaw7+N69+Fhzc8vBxJSM2NS0rDv4FeWg50EAEIDa2DEoyN9L23jN6kAGQ2YJh9OzN9RK1osvx++e3EvJiElJy4LJvV4GASDBFBQUkLuLw+jdFtt9VFQGb+dwMFKO8/EafPLy8l0tL18eTkxOj05Jy7oKk3t9AwJAQm3csFbez9vNdpL6RFcelzuYjOP87i27cnJCNptzJCsnLyoqJuHSLw8Ic5COFCAAJMzsWTPwZT3jZUsWBQgEgi/JeEQX/+LLyckiNgerLS07EhGXkHIOtuyKBwSAhBgxYjhyc3aYvsPMJFBWVtaIy8VId2AHP5YrJyuLOBj3bMmhivC4hJQTsGVXvCAAJKAyzW6L7cquzvbuo0aOtOFwOAqfUpmGCOfxaTTaxZpjJyNCwiKP/lPdPdA3IADEaPGiBXjlXTNNjXl+XC5XjYzLerJMJp4At36ovxARl5haUlVdJxB3m8B/QQCIwZgxo/FlvXnrjA1DZWRklpDxxWcwZBCDwXx44eKl2Ijo+Jyq6jpydWtIAgKgD+HVaWysLIa4Otl7q6oOtuRwMAZenINsQxomg9F8/+df4lPSstIysnLf8vmfd4sO6D0QAH1Eb+Vymq+Pm/m8ObN9uVxsFNmW9fBNPPLycm8fPHycGZ+YGpdfWPy8vR1q7kk6CIBepqaG7+Lz1lxnbBgmJUXXJVt3//clPTn+ixcteYkpGZGx8ckPXrxoEXezwL8EAdBLpKWlkb2tlYqbs4OPioqyFd7d7+wUkWpmH79Nh83mlCcmp4fHxCVdeQpHcwkHAqAXaGtpoIiwQDMtjbkBXB53DJm6+zTa73MZfH7ndyWl5SH745NPXb32o7ibBT4RBEAPGj58GPL2cJ69bevmMAaDsZJsdfiYTAai0eg36y9cDgsOjSw9feasuJsEPhMEQA8x37Gtn6+3m/uokcP3cjiYAplm97uv0WIyG6/fuLk/OCwq83JdHtEAAAmbSURBVGhlDQYltskBAuAzTf9yGt7dN1q2VDeMz+dPJlMtvvcz+/fu/5ySnJoZdyD/4Esynk2gMgiATyQvL4+83J3G7LHeFaqoqLiFTOP8d4d18DLbhYnJGWFR++MfvH7dKu5mgV4AAfAJ9Fctp4UE+dpM/3KqP4ZxVciyd//9BB+Xyzt2sLgsyDcw7OKTJ43ibhboRRAAH2HE8OHI39dj9tYtG6PodHxNn02qCT46XeraqTNng339Q+CwDkVAAPxL27ZuVggK8PYcNXK4E5vNkSPLJBi+X0FWVrbpxxs3o4JDIzOPVNbwxN0m0HcgAP7BtKmTUWiw//JVK5ZGdXV1kebCDSm8DJeCfEdj49O06NjE6Ny8ohaY4KMeCIC/2enmaG+j4unuHDRo4IDdHIxDJ8NH/90OPtHbt+2lSalZwYkp6XefPftV3M0CYgIB8BdmzpiOosKDN+gu1AnncnlqbA45ZvhlZZl4laH6svKjAWHh+0/dvHVb3E0CYgYB8AF8BtzL3Xm43Z7dEf0UFU3IsrTXfUSXyXx04eLlsH0R+3Nr6o4Lxd0mIBkgAD7Yvx8TGbp17pxZ+zAMG8EhwdIevp6voCDf/vDRk6TY+OSYzKwDrfxOOJsP/ovyAYB/9b09XUY52FpFycrKbiTDcd33J/Xa2tpLU9KzA2NiE+/BEV3wVygdADramig6ImTb3Dmzwjkczhdk2L//bj3/UvmRav/QfdEnbty8Je4mAQkmTdWvvq+X6wh7W6toJpP5NRm++tLSUvi/16/Xf7y5Lyg0MqOyqhb6+uAfUS4AZnw1HSXGRW7S1poXxWZzRhD9q/9u3z7v5ctXGb7+oftS0rN+I+P1YaB3UCcAaDS0185msL+PW5SiosL2jg7if/Xx23V4PP7JvIJi36CQiMtwdTb4WJQIgPHj1FBifNSq5UsXx3O53P8Q/QuJL+sxGDK//FB/MdA3IKTo+3Pnxd0kQFCkDwAz0y1yoUG+wV8MHeLIZrPpiPi36LIePXqcGBOXFJmemftWKIQlffDpSBsAysqDUGz0vllbNm1I6eTz5xJ9N5+cnBzicrmVCUlpvmERMbdaWl6Ku0mABEgZAPN1NFF6cpyduvqEUDab04/IJ/e6u/syMvfPfHfO18cv+PCly1fE3SRAIqQKAHwDjIeb0xBPN8dEJpO5gcgn937v7suxHj9pigsLj4nKzs1vF3ebAPmQJgBGjRqJ0pJil6xcsSQNw7DxPB6P6LP7NemZB7wCgvbdetECF22A3kGKANDXW4ES46I8R40cEcBisRmIwMU5mEzGg3P1F/38AkKLvz9XL+4mAZIjfAB4eTgP8fZwSZWSkjLmEHSiDx+6KMjL8379rTkpIiouLDk1o5XI8xaAOKSJPMufk5GsvdpgZTaHg03k8/mIiJhMJhIKhWdz8go9AoPDLz2F4hygDxEyAGbN/ArlZCZbTpsyOZrFYisigtbcl5OTbb5x83awj39Iam3dCfjkgz5HuAAw2bxROiYqNFZ50EBbol69hR/VbX3ztiAmNtEnPCq2icMhfu0BQEyECoB9IQFD9tpbH0AIrSTidl4ZGWnEYDDufHP6rIeLm0/N7Tt3xd0kQHHSRNkMkxgXOcVy145SNpszhWjbX7sn+RTkuU1Pf40LDosMy87J7xB3mwAgTABkpSdO2bZty/GOtvYRiGCYDAYSCIXnCg8ecvHxD7nc1PRU3E0CgDgBsC/EX9nUZFMp0V7+d/X43ty793OIq6dvfG3dCYG42wQAoQJgyaKFyMHOOobD4UxBBCu/zePxaxOTM1wCQ8Lvw8WaQFJJS/K42cfbTVdGRsaUKJdvvjuu29xw5aqvi7tv1rkf4Jw+kGwSGwCrVi5D2ppznblcjBBn+H+/VZd7KHRftFtYeHQjRvBSY4AaJDYATE02qdPpUkslfUfsu6/+r5cbrng4uXoXnr9wSdxNAoDYATBggBKaPWvGUj6fL4sk/6tfEhYe7RqyL/oZ0QuMAuqRyAAYO2Y0GqKqoikQCCT5q//8csNVd2c378L68xfF3SQAyBMAk9Qn4qfjxkhiGa93X/2KsPAYx9B9UU0w1gdEJpEBQKPTmIiG+iOJ282n8PrK1eteji5eGfXnL4i7SQCQMwCQCOEz/xIz+89gdNcY+SYpJcPO0yfwJzZBDyEBQIgAoEvRuTREk4j98ooKCtiDR4+DHV08w+HILiAbiQyAx48bRRiX24x3u8VVGUdaSgoxZZk3yyoqrR2c3M83N78QSzsAoFwAPHj4CLW2vmkYNGigkThWAvCinG1t7RluXv6uSSkZUI0XkJZEBgD+tb1776czixfNF2KYgN7HE32vrl677mhj51zYcOVaXz0aALGQyADAlZZVXFq2RPcqQmhOXzxPRloaSUlL16ekZe1y8/S7R9QCowCQIgDKyo8KnR1tE8epjc3v7YKf+LVbr1tbE109/FwLCouJe6EAAGQJgI6ODhSbkFKUnhy3m8/n6/TWc/r1U2y7eu1H+93WDvnXrt/orccAIJEkNgBwWdl5QgO9FbZGBnpnO1isAb2wnfd2UXHZdjsH16tv3r7tyR8PACFIdADgzHfZ3hhaVWYxd86sYhaLJdMTP5MhI4OX6ar08Q+2CAuPedUTPxMAIpL4AHjd2oq+NtleXlyQY6apMTeDxWIpfs7eALwk94sXL/c7uXm7lB4ql/DDxgBQPABwjY1Pkb7RhuKUxP2N69capQgEgukfOzEoLS2F5GTlXl6+ctXdao9j7vUfb/ZaewEgCkIEAO7Nm7do89ad5+u2btLxdHOyVZ/4HyuhUDgaDwKBQPh/dgzia/p0Og3JyDDwevxtzc0tJVH7EyP2Rex/DOf2ASBYALxXUFjCqqqqCzcy1MtYbbBKf87smfoqg5VnyMrKD0FIhBcQoSFE43Xy+W/etrXfvX2n4WTtsZOVFUerHzU2Nom7+QBIFMIFAK6tvR3lF5a05heWFKgMVi4YN05NfsJ/xg3CiwmJRIguJUVvf/br87c//fTLW7hsEwCSBcCHXr56jf/iXLzUgG/deybu9gBAJIQPAADAp4MAAIDCIAAAoDAIAAAoDAIAAAqDAACAwiAAAKAwCAAAKAwCAAAKgwAAgMIgAACgMAgAACgMAgAACoMAAIDCIAAAoDAIAAAoDAIAAAqDAACAwiAAAKAwCAAAKAwCAAAKgwAAgMIgAACgMAgAACgMAgAACoMAAIDCIAAAoDAIAAAoDAIAAAqDAACAwiAAAKAwCAAAKAwCAAAKgwAAAFHX/wNOrUdqeoXvowAAAABJRU5ErkJggg==";
const LOGO_MARK_DATA_URI = `data:image/png;base64,${LOGO_MARK_BASE64}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0c0e",
          padding: "72px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#f85149",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#d29922",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#3fb950",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og's ImageResponse (Satori) requires a plain <img>, not next/image */}
            <img src={LOGO_MARK_DATA_URI} width={64} height={64} alt="" />
            <div style={{ fontSize: 72, color: "#e6e8eb", display: "flex" }}>
              PostShip
            </div>
          </div>
          <div style={{ fontSize: 28, color: "#8b949e", display: "flex" }}>
            Vérifie votre site après chaque déploiement — Discord + email si
            ça casse.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            color: "#3fb950",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#3fb950",
              display: "flex",
            }}
          />
          <span>https://postship.fr</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
