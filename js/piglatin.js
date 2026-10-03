/*!
 * piglatin.js
 * The ONE shared Pig Latin translation engine for LearnPigLatin.com.
 * Every page that translates (homepage, translator page, future pages)
 * should load this file and call PigLatin.toPigLatin() / PigLatin.toEnglish().
 *
 * House style (matches the existing site):
 *   - Words that start with a vowel get "yay":        apple  -> appleyay
 *     (or "way" in the Southern dialect:               apple  -> appleway)
 *   - Words that start with consonants move them:      hello  -> ellohay
 *                                                      string -> ingstray
 *   - "y" at the START of a word is a consonant:       you    -> ouyay
 *   - "y" later in a word acts like a vowel:           my     -> ymay
 *                                                      rhythm -> ythmrhay
 *   - "qu" is not special (site style):                queen  -> ueenqay
 *   - Numbers, emails and web addresses are left alone.
 *   - Punctuation stays where it was; hyphenated words are translated part by part.
 *   - Capitalization is kept: Hello -> Ellohay, HELLO -> ELLOHAY.
 *
 * Pig Latin -> English is ambiguous by nature ("antway" could be "want" or
 * "twan"). This engine picks the most likely English spelling using small
 * tables of how common English words begin and end. It gets most everyday
 * words right, but it is a best guess, not a dictionary lookup.
 */
(function (root) {
  'use strict';

  var VOWEL_SUFFIX = 'yay';     // Northern dialect (the site default)
  var WAY_SUFFIX = 'way';       // Southern dialect

  // options: { dialect: 'yay' | 'way' }. Anything other than 'way' means 'yay'.
  function suffixFor(options) {
    return options && options.dialect === 'way' ? WAY_SUFFIX : VOWEL_SUFFIX;
  }

  // ---------- Character helpers ----------

  // Strip accents so "é" counts as the vowel "e".
  function baseLetter(ch) {
    return ch.normalize ? ch.normalize('NFD').charAt(0).toLowerCase() : ch.toLowerCase();
  }
  function isVowelChar(ch) {
    return 'aeiou'.indexOf(baseLetter(ch)) !== -1;
  }
  // In the middle of a word, "y" behaves like a vowel (my, gym, rhythm, happy).
  function isVowelAt(word, i) {
    var ch = word.charAt(i);
    if (isVowelChar(ch)) return true;
    return i > 0 && baseLetter(ch) === 'y';
  }

  var LETTER = /\p{L}/u;
  var HAS_DIGIT = /\p{N}/u;
  var WORD_OK = /^[\p{L}\p{M}'\u2019]+$/u;        // letters plus apostrophes
  var EDGE = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su;

  function isLetter(ch) { return LETTER.test(ch); }

  // ---------- Capitalization ----------

  // Returns "upper" (HELLO), "title" (Hello), or "lower" (hello, iPhone).
  function casePattern(word) {
    var letters = word.split('').filter(isLetter);
    if (!letters.length) return 'lower';
    var upper = letters.filter(function (c) { return c !== c.toLowerCase() && c === c.toUpperCase(); }).length;
    if (letters.length > 1 && upper === letters.length) return 'upper';
    var first = letters[0];
    if (first !== first.toLowerCase()) return 'title';
    return 'lower';
  }
  function applyCase(word, pattern) {
    if (pattern === 'upper') return word.toUpperCase();
    word = word.toLowerCase();
    if (pattern === 'title') {
      for (var i = 0; i < word.length; i++) {
        if (isLetter(word.charAt(i))) {
          return word.slice(0, i) + word.charAt(i).toUpperCase() + word.slice(i + 1);
        }
      }
    }
    return word;
  }

  // ---------- Token handling shared by both directions ----------

  // Splits text into words and spaces, splits words on hyphens/dashes,
  // peels punctuation off the edges, and runs `fn` only on the real word.
  function mapWords(text, fn) {
    if (typeof text !== 'string' || !text) return '';
    return text.split(/(\s+)/).map(function (chunk) {
      if (!chunk || /^\s+$/.test(chunk)) return chunk;
      return chunk.split(/([-\u2010\u2011\u2012\u2013\u2014\u2015])/).map(function (part) {
        if (!part || /^[-\u2010-\u2015]$/.test(part)) return part;
        var m = part.match(EDGE);
        if (!m) return part;
        var lead = m[1], core = m[2], trail = m[3];
        if (!core) return part;
        // Leave numbers, emails, web addresses, and other non-words untouched.
        if (HAS_DIGIT.test(core) || !WORD_OK.test(core)) return part;
        return lead + fn(core) + trail;
      }).join('');
    }).join('');
  }

  // ---------- English -> Pig Latin ----------

  function wordToPigLatin(word, suffix) {
    suffix = suffix || VOWEL_SUFFIX;
    var pattern = casePattern(word);
    var lower = word.toLowerCase();
    var result;

    if (isVowelChar(lower.charAt(0))) {
      result = lower + suffix;
    } else {
      // Move the leading consonant cluster (letters only) to the end.
      var i = 0;
      while (i < lower.length && isLetter(lower.charAt(i)) && !isVowelAt(lower, i)) i++;
      if (i === 0) {
        result = lower + suffix;                 // e.g. starts with an apostrophe
      } else if (i >= lower.length) {
        result = lower + 'ay';                   // no vowels at all: "hmm" -> "hmmay"
      } else {
        result = lower.slice(i) + lower.slice(0, i) + 'ay';
      }
    }
    return applyCase(result, pattern);
  }

  function toPigLatin(text, options) {
    var suffix = suffixFor(options);
    return mapWords(text, function (word) { return wordToPigLatin(word, suffix); });
  }

  // ---------- Pig Latin -> English ----------

  // How often English words START with each consonant cluster, weighted by
  // how common the words are (built from the 6,000 most used English words).
  // Only clusters listed here can be moved back to the front of a word.
  var ONSETS = parseTable(
    'c:10000 s:9199 m:8400 r:8200 d:7134 b:6906 f:6638 h:6544 l:6437 p:6052 w:5932 t:5135 ' +
    'th:3821 n:3589 g:3497 pr:3446 v:1905 j:1886 ch:1851 tr:1688 sh:1548 y:1460 wh:1384 ' +
    'k:1088 gr:1078 pl:1076 br:1050 cl:1040 fr:935 cr:906 sp:890 str:717 q:514 bl:480 sc:456 ' +
    'kn:418 thr:416 fl:415 ph:413 wr:323 tw:281 sm:270 sl:241 sw:240 sch:207 chr:178 gl:157 ' +
    'sk:143 scr:118 z:113 spr:103 x:57 sq:53 sn:53 spl:24 phr:16 rh:3 shr:3 gn:2 sph:2 dw:2'
  );
  // How often English words END with each consonant cluster ("" = ends in a vowel).
  var CODAS = parseTable(
    ':10000 d:2696 n:2670 r:2241 s:2202 ng:2025 l:1275 t:1246 nt:762 nd:572 st:530 rs:512 ' +
    'm:490 ns:451 w:408 ll:398 p:371 ss:300 c:260 ck:252 rt:224 ght:216 nts:216 f:214 ld:214 ' +
    'ts:198 ct:197 rd:189 th:182 ch:166 ls:149 sh:147 k:143 nds:131 wn:111 ms:105 rn:104 ' +
    'x:103 nk:96 gh:96 g:96 ds:89 ngs:88 ps:85 lf:84 rm:84 ws:82 rk:80 b:76 rts:71 sts:71 ' +
    'lt:70 rds:68 ft:63 lls:63 cts:62 cs:60 h:58 tch:57 ff:52 pt:48 cks:48 rth:45 ks:41 ' +
    'nks:40 nch:40 rch:39 rst:37 ghts:37 lk:35 gn:34 sk:32 xt:30 rms:30 mp:28 rks:25 rns:22 ' +
    'rld:21 lth:21 rl:21 v:21 gs:21 sm:20 lp:18 nst:17 lm:17 lts:15 mn:15 nth:13 tt:13 ' +
    'lks:13 hn:12 dd:12 bs:12 bt:12 ngth:12 gns:12 mb:12 lds:12 nths:11 sks:11 dr:10 pp:10 ' +
    'rls:9 q:9 tc:8 wth:8 j:8 ph:8 bc:7 rp:7 wns:7 dds:7 mpt:6 fth:6 nc:6 lps:6 rgh:6 mps:6 ' +
    'sc:6 wd:5 lms:5 wl:5 pth:5'
  );
  function parseTable(s) {
    var t = {};
    s.trim().split(/\s+/).forEach(function (pair) {
      var k = pair.split(':');
      t[k[0]] = Number(k[1]);
    });
    return t;
  }

  // Less common words that START with "y" (the most common ones, like "you",
  // "yes" and "year", are already in COMMON_FIXES below). Without this,
  // "ellowyay" would read as "ellow" instead of "yellow".
  var Y_WORDS = toSet(
    'yellow yelled yelling yell yard yards yarn yawn yolk yoga yogurt yum yummy yacht yak ' +
    'yank yikes yield yay yo yuck yoyo yeti yodel yippee yesterday youngest younger youth ' +
    "you're you'll you've you'd"
  );

  // WAY_WORDS: Pig Latin forms ending in "way" that are really common
  // consonant words whose moved sound ends in W (ithway = with, eetsway = sweet).
  // Any other "...way" word is read as a vowel word (Southern dialect:
  // applesway = apples). A "!" marks words that win outright; the few without
  // "!" are true twins ("inway" = win or in), decided by the selected dialect.
  var WAY_WORDS = (function () {
    var t = {};
    (
    'eway:we! ithway:with! asway:was! illway:will! ereway:were! ouldway:would! otway:two! antway:want! ' +
    'ellway:well! ayway:way! orkway:work! orldway:world! ithoutway:without! omenway:women! ' +
    'eekway:week! aterway:water! entway:went! arway:war! orkingway:working! ithinway:within! ' +
    'inway:win antedway:wanted! aitway:wait! omanway:woman! atchway:watch! estway:west! ' +
    'orksway:works! ordway:word! ordsway:words! antsway:wants! ifeway:wife! onway:won ' +
    'eeksway:weeks! ishway:wish! orkedway:worked! orthway:worth! ebsiteway:website! alkway:walk! ' +
    'ashingtonway:washington! aitingway:waiting! aysway:ways! allway:wall annaway:wanna! ' +
    'atchingway:watching! eightway:weight esternway:western! elcomeway:welcome! ' +
    'inningway:winning! ideway:wide! owway:wow! orkersway:workers! eekendway:weekend! ' +
    'onderway:wonder! orstway:worst! earway:wear! eetsway:sweet! interway:winter! orseway:worse! ' +
    'illiamway:william! eatherway:weather! alkingway:walking! earingway:wearing! ' +
    'onderfulway:wonderful! icetway:twice! indway:wind! orryway:worry! ittertway:twitter! ' +
    'eddingway:wedding! asteway:waste! eirdway:weird! ildway:wild! indowway:window! ' +
    'innerway:winner! oodway:wood! akeway:wake! eaponsway:weapons! ebway:web! ineway:wine! ' +
    'atchedway:watched! illingway:willing! indowsway:windows! armway:warm insway:wins! ' +
    'alkedway:walked! illiamsway:williams! eakway:weak! entytway:twenty! orriedway:worried! ' +
    'allsway:walls! aveway:wave! ingway:wing! itchsway:switch! alesway:wales! arningway:warning! ' +
    'arsway:wars! ednesdayway:wednesday! eeklyway:weekly! eaponway:weapon! etway:wet! ' +
    'idelyway:widely! orldwideway:worldwide! ilsonway:wilson! onderingway:wondering! ' +
    'itnessway:witness! earsway:swear! ealthway:wealth! iseway:wise! antingway:wanting! ' +
    'ashway:wash! atersway:waters! oodsway:woods! ageway:wage ingsway:wings! ' +
    'immingsway:swimming! elfareway:welfare! innersway:winners! ireway:wire! orkerway:worker! ' +
    'alkerway:walker! edensway:sweden! ardway:ward! avesway:waves! ayneway:wayne! ' +
    'alterway:walter! isconsinway:wisconsin! elvetway:twelve! ishesway:wishes! olfway:wolf! ' +
    'intway:twin! ildlifeway:wildlife! oodenway:wooden! alksway:walks! oundedway:wounded! ' +
    'arriorsway:warriors! isdomway:wisdom! itnessesway:witnesses! oreway:wore! ' +
    'orshipway:worship! orthyway:worthy! eedway:weed! aitedway:waited! arrenway:warren! ' +
    'ornway:worn! agesway:wages ellsway:wells! arrantway:warrant! iderway:wider! oundway:wound! ' +
    'itzerlandsway:switzerland! orldsway:worlds! isttway:twist! indsway:winds! okeway:woke! ' +
    'edishsway:swedish! imsway:swim! isssway:swiss! ealthyway:wealthy! ebsitesway:websites! ' +
    'irelessway:wireless! onderedway:wondered! astedway:wasted! eaknessway:weakness! ' +
    'idespreadway:widespread! arnedway:warned! atsonway:watson! eettway:tweet! ' +
    'arriorway:warrior! orriesway:worries! iftsway:swift! instway:twins! alletway:wallet! ' +
    'elshway:welsh! orkshopway:workshop! eatsway:sweat! itchedsway:switched! ashingway:washing! ' +
    'orryingway:worrying! arnerway:warner! astingway:wasting! itchway:witch! ashedway:washed! ' +
    'atchesway:watches! eetedtway:tweeted! ontway:wont! arehouseway:warehouse! idowway:widow! ' +
    'ivesway:wives! oundsway:wounds! itchingsway:switching! allaceway:wallace! ' +
    'arfareway:warfare! armingway:warming! eekendsway:weekends! ithdrawway:withdraw! ' +
    'ithdrawalway:withdrawal! itnessedway:witnessed! orkplaceway:workplace! arnway:warn! ' +
    'idthway:width! orkoutway:workout! eetstway:tweets! ipeway:wipe! olvesway:wolves! ' +
    'estminsterway:westminster! ishedway:wished! ondersway:wonders! eighway:weigh! ' +
    'ickedway:wicked! istedtway:twisted! adeway:wade! eepsway:sweep! ewway:wwe! aistway:waist! ' +
    'elcomedway:welcomed! itway:wit akingway:waking! almartway:walmart! angway:wang! ' +
    'ildernessway:wilderness! apsway:swap! eptsway:swept! ifiway:wifi! ishingway:wishing! ' +
    'orkforceway:workforce! izardway:wizard!'
    ).trim().split(/\s+/).forEach(function (pair) {
      var k = pair.split(':'), w = k[1];
      var strong = w.charAt(w.length - 1) === '!';
      t[k[0]] = { word: strong ? w.slice(0, -1) : w, strong: strong };
    });
    return t;
  })();

  // COMMON_FIXES: everyday words that the rules above would reverse wrongly,
  // generated by testing the engine against the most used English words.
  // When two English words share the same Pig Latin (how / who both become
  // "owhay"), the more common word is listed.
  var COMMON_FIXES = (function () {
    var t = {};
    (
    'ouyay:you asway:was ouryay:your ishay:his ashay:has otway:two earyay:year earsyay:years ' +
    'illstay:still atestay:state elphay:help oolschay:school artstay:start etyay:yet ' +
    'atesstay:states opstay:stop allsmay:small oughthay:though esyay:yes orystay:story ' +
    'oungyay:young ourshay:hours esearchray:research artedstay:started inway:win ithay:hit ' +
    'eahyay:yeah orkyay:york ortshay:short aystay:stay eportray:report earthay:heart ' +
    'ourselfyay:yourself idskay:kids udystay:study udentsstay:students estray:rest ' +
    'acespay:space onway:won arstay:star esultray:result andshay:hands othay:hot ' +
    'elationshipray:relationship andstay:stand uffstay:stuff ivedray:drive eengray:green ' +
    'epstay:step iencescay:science ylestay:style agestay:stage affstay:staff ' +
    'artingstay:starting asspay:pass eepslay:sleep allway:wall otewray:wrote eakspay:speak ' +
    'ecificspay:specific andardstay:standard itewray:write etworknay:network entspay:spent ' +
    'orestay:store udentstay:student ationstay:station opdray:drop udiesstay:studies ' +
    'enescay:scene endspay:spend atementstay:statement appenshay:happens aintray:train ' +
    'oriesstay:stories urthay:hurt eachray:reach upidstay:stupid ockstay:stock umptray:trump ' +
    'ingspray:spring eamdray:dream ichray:rich inskay:skin eetsway:sweet inkdray:drink ' +
    'ivingdray:driving otspay:spot ugdray:drug atusstay:status eathay:heat ighesthay:highest ' +
    'andingstay:standing arsstay:stars obertray:robert eenscray:screen owslay:slow ' +
    'affictray:traffic uaresqay:square oppedstay:stopped icetway:twice alescay:scale ' +
    'orescay:score artsmay:smart artsstay:starts ittertway:twitter awdray:draw eadspray:spread ' +
    'allersmay:smaller onestay:stone iritspay:spirit andardsstay:standards ugsdray:drugs ' +
    'osthay:host eadershiplay:leadership essdray:dress equestray:request ickstay:stick ' +
    'iverdray:driver ightlyslay:slightly oursyay:yours ydray:dry atedstay:stated ' +
    'oppeddray:dropped onesthay:honest ortspay:sport epsstay:steps ouseshay:houses ' +
    'ottscay:scott yskay:sky inkingdray:drinking eelstay:steel evestay:steve owdcray:crowd ' +
    'omeshay:homes eestray:trees otlandscay:scotland uckstay:stuck amadray:drama eadshay:heads ' +
    'eduleschay:schedule ientificscay:scientific okesmay:smoke eglay:leg owsnay:snow ' +
    'ormstay:storm udiostay:studio outubeyay:youtube itshay:hits eadslay:leads ostspay:posts ' +
    'ecificallyspay:specifically itsplay:split entytway:twenty oopstray:troops irtshay:shirt ' +
    'owlyslay:slowly adiumstay:stadium oresstay:stores aftdray:draft unkdray:drunk ' +
    'umanshay:humans undredshay:hundreds okespay:spoke andsstay:stands oldshay:holds ' +
    'epublicray:republic atisticsstay:statistics eamsdray:dreams ainspay:spain ' +
    'awingdray:drawing enesscay:scenes emeschay:scheme oodstay:stood oragestay:storage ' +
    'ansportationtray:transportation iversdray:drivers eepingslay:sleeping eliefray:relief ' +
    'oofray:roof ayingstay:staying ivendray:driven awndray:drawn athay:hat ayedstay:stayed ' +
    'iestray:tries okingsmay:smoking atementsstay:statements earsway:swear ationsstay:stations ' +
    'ephenstay:stephen aditiontray:tradition adnay:dna'
    ).trim().split(/\s+/).forEach(function (pair) {
      var k = pair.split(':');
      t[k[0]] = k[1];
    });
    return t;
  })();

  function toSet(s) {
    var t = {};
    s.trim().split(/\s+/).forEach(function (w) { t[w] = true; });
    return t;
  }

  function trailingConsonants(s) {
    var i = s.length;
    while (i > 0 && isLetter(s.charAt(i - 1)) && !isVowelChar(s.charAt(i - 1)) && baseLetter(s.charAt(i - 1)) !== 'y') i--;
    return s.slice(i);
  }

  function codaScore(stem) {
    return Math.log(CODAS[trailingConsonants(stem)] || 1);
  }

  // Best consonant reading of a Pig Latin word, or null.
  function consonantReading(w) {
    var base = w.slice(0, -2);
    // A word with no vowels at all ("hmmay") just loses its "ay".
    if (!/[aeiouy]/.test(base.normalize ? base.normalize('NFD') : base)) return base;
    var tail = trailingConsonants(base);
    var best = null, bestScore = -Infinity;
    for (var k = 1; k <= tail.length; k++) {
      var cluster = base.slice(base.length - k);
      var stem = base.slice(0, base.length - k);
      if (!stem) continue;
      if (!ONSETS[cluster]) continue;
      var sc = Math.log(ONSETS[cluster]) + codaScore(stem);
      if (sc > bestScore) { bestScore = sc; best = cluster + stem; }
    }
    if (best === null && tail.length) {
      // Word with no vowels at all ("hmmay" -> "hmm"), or an unusual cluster:
      // move the whole cluster (or just the last letter) back.
      best = tail.length === base.length ? base : tail.slice(-1) + base.slice(0, -1);
    }
    return best;
  }

  // Returns the best English guess for one lowercase Pig Latin word,
  // or null if the word does not look like Pig Latin at all.
  // Both YAY and WAY vowel words are always recognized; `dialect` only
  // breaks ties for the few true twins ("asway" = "was" or "as").
  function guessEnglish(w, dialect) {
    if (w.length < 3 || w.slice(-2) !== 'ay') return null;
    var plain = w.replace(/\u2019/g, "'");

    var ending = w.slice(-3);
    var stem = w.slice(0, -3);
    var stemKey = stem.replace(/\u2019/g, "'");
    var vowelStem = (ending === 'yay' || ending === 'way') && stem && isVowelChar(stem.charAt(0)) ? stem : null;

    if (vowelStem && ending === 'way') {
      // "ithway" -> "with", but "appleway" / "applesway" / "Iway" -> "apple" / "apples" / "I".
      var hit = Object.prototype.hasOwnProperty.call(WAY_WORDS, plain) ? WAY_WORDS[plain] : null;
      if (hit && (hit.strong || dialect !== 'way')) return hit.word;
      return vowelStem;
    }

    if (Object.prototype.hasOwnProperty.call(COMMON_FIXES, plain)) return COMMON_FIXES[plain];

    if (vowelStem && ending === 'yay') {
      // Site style: "appleyay" -> "apple", but "ellowyay" -> "yellow".
      return Y_WORDS['y' + stemKey] ? 'y' + vowelStem : vowelStem;
    }
    return consonantReading(w) || w.slice(0, -2);
  }

  function wordToEnglish(word, dialect) {
    var pattern = casePattern(word);
    var guess = guessEnglish(word.toLowerCase(), dialect);
    if (guess === null) return word;             // not Pig Latin: leave it alone
    // Keep "I" capitalized, as English expects.
    if (guess === 'i') return 'I';
    return applyCase(guess, pattern);
  }

  function toEnglish(text, options) {
    var dialect = options && options.dialect === 'way' ? 'way' : 'yay';
    return mapWords(text, function (word) { return wordToEnglish(word, dialect); });
  }

  // mode: "enToPig" or "pigToEn" (matches the translator's <select> values)
  // options: { dialect: 'yay' | 'way' } (optional; default 'yay')
  function translate(text, mode, options) {
    return mode === 'pigToEn' ? toEnglish(text, options) : toPigLatin(text, options);
  }

  var api = {
    toPigLatin: toPigLatin,
    toEnglish: toEnglish,
    translate: translate,
    wordToPigLatin: wordToPigLatin,
    wordToEnglish: wordToEnglish,
    VOWEL_SUFFIX: VOWEL_SUFFIX,
    WAY_SUFFIX: WAY_SUFFIX
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PigLatin = api;
})(typeof window !== 'undefined' ? window : this);
