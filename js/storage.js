const Storage = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error("Could not read saved data:", error);
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },
};

// Password hashing (SHA-256, works on file:// and http://).
// Note: this is client-side only; real security needs a backend.
const Auth = {
  sha256(text) {
    let ascii = unescape(encodeURIComponent(text));
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = Math.pow(2, 32);
    const words = [];
    const bitLength = ascii.length * 8;
    let hash = [],
      k = [],
      primes = 0,
      i,
      j,
      result = "";
    const composite = {};

    for (let c = 2; primes < 64; c++) {
      if (!composite[c]) {
        for (i = 0; i < 313; i += c) composite[i] = c;
        hash[primes] = (Math.pow(c, 0.5) * maxWord) | 0;
        k[primes++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";

    for (i = 0; i < ascii.length; i++) {
      words[i >> 2] |= ascii.charCodeAt(i) << (((3 - i) % 4) * 8);
    }
    words[words.length] = (bitLength / maxWord) | 0;
    words[words.length] = bitLength;

    for (j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const old = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15],
          w2 = w[i - 2];
        const a = hash[0],
          e = hash[4];
        const t1 =
          hash[7] +
          (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) |
                0);
        const t2 =
          (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }

      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  },

  hash(userId, password) {
    return Auth.sha256("hcm::" + userId + "::" + password);
  },

  verify(user, password) {
    return user.passwordHash
      ? user.passwordHash === Auth.hash(user.id, password)
      : user.password === password;
  },

  setPassword(user, password) {
    user.passwordHash = Auth.hash(user.id, password);
    delete user.password;
  },
};
