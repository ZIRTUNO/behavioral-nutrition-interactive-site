import type { Metadata } from "next";
import "./globals.css";
import { fontSans, fontSerif, fontScript, fontQuestion } from "@/styles/fonts";
import { PRIME_ASSETS } from "@/components/BrainModel/constants";
import { CONTACT } from "@/lib/contact";
import { Header } from "@/components/layout/Header/Header";
import { SitePreloader } from "@/components/Preloader/SitePreloader";
import { CopyGuard } from "@/components/CopyGuard";
import { VideoLightboxProvider } from "@/components/video/VideoLightbox";
import { PolaroidLightboxProvider } from "@/components/polaroid/PolaroidLightbox";

// Origem/basePath/URL canônica vivem em lib/site.ts (compartilhados com
// robots.ts e sitemap.ts). Ao migrar para um domínio próprio, trocar somente
// SITE_ORIGIN lá.
import { SITE_ORIGIN, BASE_PATH, SITE_URL } from "@/lib/site";

/** Nome da marca — usado no og:siteName/og:title (cards de WhatsApp/redes,
 *  onde a marca importa mais que a keyword) e no JSON-LD. */
const SITE_TITLE = "Juliana Delmonte · Nutricionista Comportamental";
/** Frase-assinatura — fica nos cards sociais e no JSON-LD. */
const SITE_DESCRIPTION =
  "Nutrição comportamental para sair do ciclo de recomeçar toda segunda-feira.";

/** <title> da busca: profissão + cidade primeiro (o que as pessoas digitam —
 *  "nutricionista juiz de fora"), marca no fim, onde a truncagem corta menos. */
const SEO_TITLE =
  "Nutricionista Comportamental em Juiz de Fora e Online | Juliana Delmonte";
/** Meta description (~150 chars): keyword + cidade + a frase da marca + o
 *  diferencial. É o texto do snippet no Google, não aparece na página. */
const SEO_DESCRIPTION =
  "Nutricionista comportamental e neuroterapeuta em Juiz de Fora e online. " +
  "Saia do ciclo de recomeçar toda segunda-feira, sem dieta restritiva e sem culpa.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  // Canonical ABSOLUTO de propósito: o metadataBase do Next não prefixa o
  // basePath ao resolver caminhos relativos — com "/" o canonical apontaria
  // para a raiz do host, fora do deploy.
  alternates: { canonical: SITE_URL },
  // STAGING: enquanto o site de testes vive no github.io, o workflow de deploy
  // seta NEXT_PUBLIC_NOINDEX=1 e esta meta impede o Google de indexar a URL
  // temporária (que depois competiria com o domínio definitivo como conteúdo
  // duplicado). No lançamento, basta remover a env do workflow.
  ...(process.env.NEXT_PUBLIC_NOINDEX === "1" && {
    robots: { index: false, follow: false },
  }),
  // A imagem dos cards (og:image / twitter:image) vem da file convention
  // src/app/opengraph-image.png — o Next emite as tags com URL absoluto via
  // metadataBase. Idem para os ícones (src/app/icon.png / apple-icon.png).
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
  },
};

/** FAQ em texto puro para o schema FAQPage. ESPELHA o copy das respostas em
 *  sections/Faq/index.tsx (lá é JSX, aqui é string) — ao editar uma resposta,
 *  atualizar os dois. Duplicado de propósito: importar dados de um módulo
 *  "use client" num server component vira client reference, e extrair o copy
 *  para um terceiro arquivo mexeria na seção (WIP) sem necessidade. */
const FAQ_LD: Array<[question: string, answer: string]> = [
  [
    "Vou ter que cortar carboidrato?",
    "Não. Aqui nenhum alimento entra em lista proibida: nem o pão, nem o chocolate. A gente trabalha o como e o porquê do comer, e aí nada precisa ser cortado à força.",
  ],
  [
    "Quanto tempo leva pra ver resultado?",
    "As primeiras mudanças aparecem já nas primeiras semanas, e começam no jeito de comer: menos culpa, menos exagero, mais constância. O corpo vem junto, no seu ritmo. E o que vem assim, fica.",
  ],
  [
    "Atende online?",
    "Sim! As consultas por vídeo têm o mesmo cuidado das presenciais e funcionam de qualquer lugar. Você só precisa de um cantinho tranquilo.",
  ],
  [
    "Aceita convênio?",
    "O atendimento é particular, mas você recebe o recibo pra pedir reembolso ao seu plano de saúde, se ele tiver essa cobertura.",
  ],
  [
    "E se eu não conseguir seguir o plano?",
    "Então a gente ajusta o plano, não você. É exatamente pra isso que existem os retornos: entender o que travou e refazer a rota com você. Aqui, sair da linha não é fracasso. É informação.",
  ],
  [
    "Já tentei de tudo. Por que agora seria diferente?",
    "Porque dessa vez ninguém vai te entregar só mais um cardápio. A gente vai olhar pra causa, o que acontece antes do prato. Quando a cabeça muda junto, o resultado para de ir embora.",
  ],
  [
    "Quanto custa?",
    "Os investimentos variam conforme o plano de acompanhamento. Entre em contato pelo WhatsApp e te apresento as opções.",
  ],
];

/** Ficha da profissional no Google (Perfil da Empresa) na forma canônica por
 *  CID. O URL longo que o Maps mostra na barra carrega parâmetros de sessão e
 *  muda; este não. */
const GOOGLE_BUSINESS_URL = "https://maps.google.com/?cid=2184787568694251848";

/** Dados estruturados (schema.org) para busca local — negócio + pessoa + FAQ
 *  num só @graph. Nome, endereço, telefone e Instagram espelham o
 *  rodapé/lib/contact.ts; o CRN real entra como hasCredential na Person (o
 *  mesmo número exibido no rodapé e na seção Sobre). `geo`,
 *  `openingHoursSpecification` e o `sameAs` do negócio espelham o Perfil da
 *  Empresa no Google — pino, horário e a própria ficha — para que o Google
 *  entenda site e perfil como a MESMA entidade, em vez de dois resultados
 *  disputando a mesma busca. */
const BUSINESS_ID = `${SITE_URL}#negocio`;
const PERSON_ID = `${SITE_URL}#juliana`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      // MedicalBusiness junto do LocalBusiness: mais específico p/ saúde.
      "@type": ["LocalBusiness", "MedicalBusiness"],
      "@id": BUSINESS_ID,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      image: `${SITE_ORIGIN}${BASE_PATH}/images/hero/logo.webp`,
      telephone: `+${CONTACT.whatsappNumber}`,
      email: CONTACT.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "R. Barão de São João Nepomuceno, 236",
        addressLocality: "Juiz de Fora",
        addressRegion: "MG",
        postalCode: "36010-081",
        addressCountry: "BR",
      },
      hasMap: CONTACT.mapsUrl,
      // Coordenadas do pino do Perfil da Empresa (Centro de Juiz de Fora),
      // entregues prontas em vez de deixar o Google inferir do endereço
      // escrito. Só entraram quando a ficha do Maps passou a existir de fato —
      // publicar um ponto aproximado errado seria pior que não ter nenhum.
      geo: {
        "@type": "GeoCoordinates",
        latitude: -21.7617274,
        longitude: -43.347454,
      },
      // Segunda a sábado, 06:00-22:00. Domingo não aparece de propósito: no
      // schema.org, dia sem entrada é dia fechado. Mesmo horário publicado no
      // Perfil da Empresa — as duas fontes têm que contar a mesma história.
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ],
          opens: "06:00",
          closes: "22:00",
        },
      ],
      // Presencial na cidade + online para o país inteiro.
      areaServed: [
        { "@type": "City", name: "Juiz de Fora" },
        { "@type": "Country", name: "Brasil" },
      ],
      founder: { "@id": PERSON_ID },
      sameAs: [CONTACT.instagramUrl, GOOGLE_BUSINESS_URL],
    },
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: "Juliana Delmonte",
      jobTitle: ["Nutricionista", "Neuroterapeuta"],
      description:
        "Nutricionista comportamental e neuroterapeuta — atendimento presencial em Juiz de Fora e online.",
      worksFor: { "@id": BUSINESS_ID },
      knowsAbout: ["Nutrição comportamental", "Neuroterapia"],
      // Registro profissional: `identifier` leva o número do CRN e
      // `recognizedBy`, o conselho que o emite (CRN-9 = Minas Gerais).
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Registro profissional",
        identifier: "CRN-9 38277",
        recognizedBy: {
          "@type": "Organization",
          name: "Conselho Regional de Nutricionistas da 9ª Região (CRN-9)",
        },
      },
      sameAs: [CONTACT.instagramUrl],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}#faq`,
      mainEntity: FAQ_LD.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // next/font/local generates a class name per family and exposes a CSS
  // variable through .variable. Apply all three on <html> so every descendant
  // — including CSS Modules in deeply nested sections — can resolve
  // var(--font-sans/serif/script) regardless of the deploy's basePath.
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontScript.variable} ${fontQuestion.variable}`}
    >
      <body>
        {/* Os preconnects do YouTube (youtube-nocookie/ytimg/google) saíram
            nesta branch: sem a seção 5 nenhum player é montado, e abrir
            DNS+TLS para hosts que ninguém vai usar só disputa banda com o
            download dos assets 3D no boot. Voltam junto com os depoimentos. */}
        {/* Start the heavy 3D downloads (GLB, HDRI, draco) with the HTML
            itself. The boot primer's fetch() calls only begin at hydration —
            after the main JS has downloaded and parsed — so on slow
            connections the whole HTML→hydration window was wasted; these
            preloads let the bytes stream through it, and the primer then
            resumes from the browser's preload cache instead of from zero.
            as="fetch" with NO crossorigin matches the primer's plain
            same-origin fetch(); a mismatch would download twice. */}
        {PRIME_ASSETS.map(({ url }) => (
          <link key={url} rel="preload" href={url} as="fetch" />
        ))}
        {/* Dados estruturados p/ busca local (Google) — ver JSON_LD acima. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* VideoLightboxProvider wraps the header AND the page so both share one
            video-viewer state: the Testimonials tiles open it, and the header's
            hamburger reads it to morph into an X that closes the playing video. */}
        <VideoLightboxProvider>
          {/* PolaroidLightboxProvider shares one pile-viewer state the same way:
              the Testimonials expand buttons open it, and the header's hamburger
              reads it to morph into the same X that closes it. */}
          <PolaroidLightboxProvider>
            {/* Sticky global header. Lives outside <main> so it persists across
                all sections / routes, and its sticky positioning anchors it to
                the viewport top while content scrolls beneath. */}
            <Header />
            {children}
          </PolaroidLightboxProvider>
        </VideoLightboxProvider>
        {/* Boot loading screen — covers everything (incl. the header) until the
            heavy first-screen assets are down and the brain has painted. */}
        <SitePreloader />
        <CopyGuard />
      </body>
    </html>
  );
}
