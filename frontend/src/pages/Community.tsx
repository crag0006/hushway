import { FormEvent, useState } from 'react'
import {
  MapPin,
  Users,
  Route,
  MessageCircle,
  Leaf,
  AlertTriangle,
  Footprints,
  Library,
  Trees,
  Coffee
} from 'lucide-react'

import Header from '../components/Header'
import Footer from '../components/Footer'
import './Community.css'

interface CommunityPost {
  id: number
  type: string
  title: string
  message: string
  time: string
}

const initialPosts: CommunityPost[] = [
  {
    id: 1,
    type: 'Quiet Place',
    title: 'Fitzroy Gardens',
    message:
      'Very quiet this morning around 9:30 AM. Plenty of shaded seating and very little traffic noise.',
    time: '10 minutes ago'
  },
  {
    id: 2,
    type: 'Crowd Update',
    title: 'Flinders Street Station',
    message:
      'Very crowded near the main entrance. The Elizabeth Street entrance was slightly quieter.',
    time: '25 minutes ago'
  },
  {
    id: 3,
    type: 'Route Tip',
    title: 'Quiet Route Tip',
    message:
      'Walking through Treasury Gardens instead of Spring Street was much calmer during the afternoon.',
    time: '1 hour ago'
  }
]

export default function Community() {
  const [postType, setPostType] = useState('Quiet Place')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts)
  const [success, setSuccess] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!location.trim() || !message.trim()) {
      return
    }

    const newPost: CommunityPost = {
      id: Date.now(),
      type: postType,
      title: location,
      message,
      time: 'Just now'
    }

    setPosts([newPost, ...posts])

    setLocation('')
    setMessage('')
    setPostType('Quiet Place')

    setSuccess('Your community update has been shared.')

    setTimeout(() => {
      setSuccess('')
    }, 3000)
  }

  const getPostIcon = (type: string) => {
    if (type === 'Quiet Place') {
      return <Leaf size={20} />
    }

    if (type === 'Crowd Update') {
      return <AlertTriangle size={20} />
    }

    return <Footprints size={20} />
  }

  return (
    <div className="community-page">
      <Header />

      <main className="community-main">

        {/* Hero */}
        <section className="community-hero">
          <div className="community-hero__content">

            <span className="community-eyebrow">
              HushWay Community
            </span>

            <h1>
              Travel calmer, together.
            </h1>

            <p>
              Share sensory-friendly places, crowd updates
              and quieter travel experiences to help others
              move through the city with more confidence.
            </p>

          </div>
        </section>


        {/* Statistics */}
        <section className="community-stats">

          <div className="community-stat-card">
            <div className="community-stat-icon">
              <MapPin size={22} />
            </div>

            <div>
              <strong>128</strong>
              <span>Quiet Places Shared</span>
            </div>
          </div>


          <div className="community-stat-card">
            <div className="community-stat-icon">
              <Route size={22} />
            </div>

            <div>
              <strong>74</strong>
              <span>Route Tips</span>
            </div>
          </div>


          <div className="community-stat-card">
            <div className="community-stat-icon">
              <Users size={22} />
            </div>

            <div>
              <strong>312</strong>
              <span>Community Members</span>
            </div>
          </div>

        </section>


        <section className="community-content">

          {/* Share Update */}
          <div className="community-share">

            <div className="community-section-heading">
              <MessageCircle size={22} />

              <div>
                <h2>Share a sensory update</h2>

                <p>
                  Help other HushWay travellers know what
                  the area feels like right now.
                </p>
              </div>
            </div>


            {success && (
              <div className="community-success">
                ✓ {success}
              </div>
            )}


            <form
              className="community-form"
              onSubmit={handleSubmit}
            >

              <div className="community-form-row">

                <div className="community-field">
                  <label htmlFor="postType">
                    Update type
                  </label>

                  <select
                    id="postType"
                    value={postType}
                    onChange={(event) =>
                      setPostType(event.target.value)
                    }
                  >
                    <option>Quiet Place</option>
                    <option>Crowd Update</option>
                    <option>Route Tip</option>
                    <option>Sensory Tip</option>
                  </select>
                </div>


                <div className="community-field">
                  <label htmlFor="location">
                    Location
                  </label>

                  <input
                    id="location"
                    type="text"
                    placeholder="e.g. Carlton Gardens"
                    value={location}
                    onChange={(event) =>
                      setLocation(event.target.value)
                    }
                    required
                  />
                </div>

              </div>


              <div className="community-field">

                <label htmlFor="message">
                  What did you notice?
                </label>

                <textarea
                  id="message"
                  placeholder="Share something helpful about noise, crowds, lighting or the overall sensory environment..."
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  required
                />

              </div>


              <button
                type="submit"
                className="community-share-button"
              >
                Share with Community
              </button>

            </form>

          </div>


          {/* Recent Updates */}
          <div className="community-feed">

            <div className="community-feed-heading">
              <div>
                <h2>Recent Community Updates</h2>

                <p>
                  Latest sensory information shared by travellers.
                </p>
              </div>
            </div>


            <div className="community-posts">

              {posts.map((post) => (

                <article
                  className="community-post"
                  key={post.id}
                >

                  <div className="community-post-icon">
                    {getPostIcon(post.type)}
                  </div>


                  <div className="community-post-content">

                    <div className="community-post-top">

                      <div>
                        <h3>{post.title}</h3>

                        <span className="community-post-type">
                          {post.type}
                        </span>
                      </div>

                      <span className="community-post-time">
                        {post.time}
                      </span>

                    </div>


                    <p>
                      {post.message}
                    </p>

                  </div>

                </article>

              ))}

            </div>

          </div>

        </section>


        {/* Popular Quiet Places */}
        <section className="community-popular">

          <div className="community-popular-heading">
            <h2>Popular Quiet Places</h2>

            <p>
              Community-recommended places for a calmer break.
            </p>
          </div>


          <div className="community-place-grid">

            <div className="community-place-card">

              <div className="community-place-icon">
                <Library size={24} />
              </div>

              <div>
                <h3>State Library Victoria</h3>

                <p>
                  Quiet indoor spaces with seating and low noise.
                </p>

                <span>Very Quiet</span>
              </div>

            </div>


            <div className="community-place-card">

              <div className="community-place-icon">
                <Trees size={24} />
              </div>

              <div>
                <h3>Fitzroy Gardens</h3>

                <p>
                  Green open areas away from busy city traffic.
                </p>

                <span>Low Crowds</span>
              </div>

            </div>


            <div className="community-place-card">

              <div className="community-place-icon">
                <Coffee size={24} />
              </div>

              <div>
                <h3>The Calm Corner Cafe</h3>

                <p>
                  Soft lighting and a quieter indoor atmosphere.
                </p>

                <span>Soft Lighting</span>
              </div>

            </div>

          </div>

        </section>


        {/* Guidelines */}
        <section className="community-guidelines">

          <h2>Community Guidelines</h2>

          <p>
            Help keep HushWay safe, supportive and useful for everyone.
          </p>

          <div className="community-guideline-list">

            <span>Be respectful</span>

            <span>
              Share useful sensory information
            </span>

            <span>
              Do not share personal information
            </span>

          </div>

        </section>

      </main>

      <Footer />
    </div>
  )
}