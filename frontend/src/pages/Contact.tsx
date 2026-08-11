import { FormEvent, useState } from 'react'
import {
  AlertTriangle,
  Accessibility,
  MessageCircle,
  Wrench,
  Mail,
  Send
} from 'lucide-react'

import Header from '../components/Header'
import Footer from '../components/Footer'
import './Contact.css'

export default function Contact() {
  const [success, setSuccess] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setSuccess(
      'Thank you. Your message has been submitted successfully.'
    )

    event.currentTarget.reset()

    setTimeout(() => {
      setSuccess('')
    }, 4000)
  }

  return (
    <div className="contact-page">
      <Header />

      <main className="contact-main">

        {/* Hero */}
        <section className="contact-hero">
          <div className="contact-hero__content">

            <span className="contact-eyebrow">
              Contact HushWay
            </span>

            <h1>
              How can we help?
            </h1>

            <p>
              Have a question, feedback, or noticed incorrect
              sensory information? Send us a message and help
              us improve the HushWay experience.
            </p>

          </div>
        </section>


        {/* Main Content */}
        <section className="contact-content">

          {/* Contact Form */}
          <div className="contact-form-card">

            <div className="contact-form-heading">

              <div className="contact-form-icon">
                <Mail size={24} />
              </div>

              <div>
                <h2>Send us a message</h2>

                <p>
                  Fill in the form below and let us know how
                  we can help.
                </p>
              </div>

            </div>


            {success && (
              <div className="contact-success">
                ✓ {success}
              </div>
            )}


            <form
              className="contact-form"
              onSubmit={handleSubmit}
            >

              <div className="contact-form-row">

                <div className="contact-field">
                  <label htmlFor="name">
                    Name
                  </label>

                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Enter your name"
                    required
                  />
                </div>


                <div className="contact-field">
                  <label htmlFor="email">
                    Email
                  </label>

                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                  />
                </div>

              </div>


              <div className="contact-field">
                <label htmlFor="reason">
                  Reason for contacting us
                </label>

                <select
                  id="reason"
                  name="reason"
                  required
                  defaultValue=""
                >
                  <option
                    value=""
                    disabled
                  >
                    Select a reason
                  </option>

                  <option value="general">
                    General enquiry
                  </option>

                  <option value="sensory">
                    Report incorrect sensory information
                  </option>

                  <option value="quiet-place">
                    Report a quiet place issue
                  </option>

                  <option value="technical">
                    Technical problem
                  </option>

                  <option value="accessibility">
                    Accessibility feedback
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>


              <div className="contact-field">
                <label htmlFor="subject">
                  Subject
                </label>

                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="Enter the subject"
                  required
                />
              </div>


              <div className="contact-field">
                <label htmlFor="message">
                  Message
                </label>

                <textarea
                  id="message"
                  name="message"
                  placeholder="Tell us more about your question, feedback or issue..."
                  required
                />
              </div>


              <button
                type="submit"
                className="contact-submit-button"
              >
                <Send size={17} />

                Send Message
              </button>

            </form>

          </div>


          {/* Support Information */}
          <aside className="contact-help">

            <div className="contact-help-heading">
              <h2>What can you contact us about?</h2>

              <p>
                Your feedback can help make HushWay more
                useful, inclusive and reliable.
              </p>
            </div>


            <div className="contact-help-list">

              <div className="contact-help-card">

                <div className="contact-help-icon">
                  <AlertTriangle size={22} />
                </div>

                <div>
                  <h3>
                    Incorrect sensory information
                  </h3>

                  <p>
                    Tell us if a crowd level, sensory indicator
                    or route condition appears incorrect.
                  </p>
                </div>

              </div>


              <div className="contact-help-card">

                <div className="contact-help-icon">
                  <Accessibility size={22} />
                </div>

                <div>
                  <h3>
                    Accessibility feedback
                  </h3>

                  <p>
                    Share suggestions that could make HushWay
                    easier to use for different accessibility
                    and sensory needs.
                  </p>
                </div>

              </div>


              <div className="contact-help-card">

                <div className="contact-help-icon">
                  <MessageCircle size={22} />
                </div>

                <div>
                  <h3>
                    General feedback
                  </h3>

                  <p>
                    Let us know what you like, what could be
                    clearer, or what would improve your journey.
                  </p>
                </div>

              </div>


              <div className="contact-help-card">

                <div className="contact-help-icon">
                  <Wrench size={22} />
                </div>

                <div>
                  <h3>
                    Technical problems
                  </h3>

                  <p>
                    Report issues with pages, buttons, maps,
                    sign-in or other HushWay features.
                  </p>
                </div>

              </div>

            </div>


            <div className="contact-note">
              <strong>
                Please do not include sensitive personal information.
              </strong>

              <p>
                Only include the information needed to explain
                your question or issue.
              </p>
            </div>

          </aside>

        </section>

      </main>

      <Footer />
    </div>
  )
}