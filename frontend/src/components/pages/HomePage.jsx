import React, { useState } from 'react';
import '../../styles/pages/HomePage.css';

const HomePage = () => {
  const [formData, setFormData] = useState({
    location: '',
    budget: '',
    images: []
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + formData.images.length <= 5) {
      setFormData(prev => ({ ...prev, images: [...prev.images, ...files] }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Handle form submission
  };

  const featuredProducts = [
    { name: '3-seater sofa', price: '₹40K' },
    { name: 'Bed', price: '₹25K' },
    { name: 'Desk', price: '₹8K' },
    { name: 'Dining set', price: '₹30K' },
    { name: 'Coffee table', price: '₹7K' },
    { name: 'Chair', price: '₹5K' },
    { name: 'Decorative lights', price: '₹2K' },
    { name: 'Wardrobe', price: '₹15K' },
    { name: 'Shoe rack', price: '₹4K' },
  ];

  const testimonials = [
    {
      name: 'Mayank Mittal',
      service: 'Home Mandir',
      text: 'Made my dream home mandir come true. Great vendors, amazing quality, and the process was smooth.'
    },
    {
      name: 'Naman Raghuvanshi',
      service: 'Chairs',
      text: 'Saved me lots of time. Got best prices within days instead of calling many vendors. Clear pricing always.'
    },
    {
      name: 'Siddharth Sharma',
      service: 'Kitchen Setup',
      text: 'Found me best vendors who understood what I wanted. The price comparison helped me choose. My family loves it!'
    }
  ];

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="promo-badge">
            <span className="promo-text">35% OFF</span>
            <span className="promo-date">Till 30th October ✨</span>
          </div>
          <h1 className="hero-title">
            Your Dream Home, Made Easy
          </h1>
          <p className="hero-subtitle">
            500+ suppliers across Delhi NCR
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">✨</span>
              <span>Tell us your need in 2 mins - it's <strong>100% free</strong></span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✨</span>
              <span>Hire top-rated professionals, <strong>hassle-free</strong></span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✨</span>
              <span>No spamming – just rates in your dashboard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Get Rates Form */}
      <section className="get-rates-section">
        <div className="container">
          <div className="rates-form-card">
            <h2 className="form-title">
              Get Rates for any interior or furniture work with <span className="highlight">Lowest Cost</span>
            </h2>
            <p className="form-subtitle">
              One form, multiple transparent rates from verified suppliers—no spam, no hidden fees, <strong>hire directly</strong>
            </p>
            <form onSubmit={handleSubmit} className="rates-form">
              <div className="form-group">
                <label>Add Images (0/5)</label>
                <div className="image-upload">
                  <input
                    type="file"
                    id="images"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  <label htmlFor="images" className="upload-label">
                    <span className="upload-icon">📷</span>
                    <span>Upload images of the design you want to buy</span>
                  </label>
                  {formData.images.length > 0 && (
                    <div className="uploaded-images">
                      {formData.images.map((img, idx) => (
                        <div key={idx} className="image-preview">
                          <span>{img.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = formData.images.filter((_, i) => i !== idx);
                              setFormData(prev => ({ ...prev, images: newImages }));
                            }}
                            className="remove-image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                >
                  <option value="">Select location</option>
                  <option value="delhi">Delhi</option>
                  <option value="noida">Noida</option>
                  <option value="gurgaon">Gurgaon</option>
                  <option value="others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <select
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">Select budget preference</option>
                  <option value="low">Low budget</option>
                  <option value="mid">Mid-range, long-lasting materials</option>
                  <option value="premium">Premium / no fixed budget</option>
                </select>
              </div>

              <button type="submit" className="submit-btn">
                Get Rates
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured-products">
        <div className="container">
          <h2 className="section-title">Popular Products</h2>
          <div className="products-grid">
            {featuredProducts.map((product, idx) => (
              <div key={idx} className="product-card">
                <div className="product-name">{product.name}</div>
                <div className="product-price">under {product.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">With minimal effort</h2>
          <p className="section-subtitle">Post → Compare → Decide</p>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Post your requirement</h3>
              <p>Snap a photo or type it out.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Compare rates</h3>
              <p>We get you multiple supplier rates fast in your dashboard.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Decide with confidence</h3>
              <p>Save time. Pick the best.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <h2 className="section-title">What Our Customers Say</h2>
          <p className="section-subtitle">Real experiences from customers</p>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="testimonial-card">
                <p className="testimonial-text">"{testimonial.text}"</p>
                <div className="testimonial-author">
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.service}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="why-choose">
        <div className="container">
          <h2 className="section-title">Why Choose Us?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-large">🔒</div>
              <h3>No spam. Your number stays private.</h3>
              <p>No spam. Your number stays private.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">📄</div>
              <h3>One requirement doc, many rates</h3>
              <p>We prepare your requirement once and share it with vetted suppliers.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">✅</div>
              <h3>Verified suppliers</h3>
              <p>KYC, portfolio and ratings checked for trustworthy choices.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">⚡</div>
              <h3>Fast responses</h3>
              <p>Get 10+ supplier rates within hours—no chasing, no spam.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">📊</div>
              <h3>Clear comparisons</h3>
              <p>Line‑item view in your dashboard to compare apples-to-apples.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">💬</div>
              <h3>Chat & negotiate</h3>
              <p>Talk to suppliers securely from your dashboard.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
