// app/market/page.tsx

import styles from "./page.module.css";
import ListingGrid from "@/components/listings/ListingGrid";

const categories = [
  { value: "",             label: "All"           },
  { value: "electronics",  label: "🖥️ Electronics" },
  { value: "fashion",      label: "👗 Fashion"     },
  { value: "home",         label: "🏠 Home"        },
  { value: "vehicles",     label: "🚗 Vehicles"    },
  { value: "services",     label: "🔧 Services"    },
  { value: "digital",      label: "💾 Digital"     },
  { value: "food",         label: "🍱 Food"        },
  { value: "other",        label: "📦 Other"       },
];

export default function MarketPage() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🛍️ Marketplace</h1>
            <p className={styles.sub}>Buy & sell items using Pi</p>
          </div>
          <a href="/market/create" className={styles.btnCreate}>+ New Listing</a>
        </div>

        <div className={styles.cats}>
          {categories.map((c) => (
            <a key={c.value} href={`/market?category=${c.value}`} className={styles.cat}>
              {c.label}
            </a>
          ))}
        </div>

        <ListingGrid />
      </div>
    </div>
  );
}
